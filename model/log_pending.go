package model

import (
	"cmp"
	"hash/fnv"
	"slices"
	"strings"
	"sync"
	"time"
)

// pendingLogTTL bounds how long an unfinished request can stay visible when
// its completion hook never runs (for example after a process crash).
const pendingLogTTL = time.Hour

// PendingLogParams describes an in-flight relay request that should appear in
// the usage-log list before the upstream call returns.
type PendingLogParams struct {
	RequestId   string
	UserId      int
	Username    string
	TokenId     int
	TokenName   string
	ModelName   string
	ChannelId   int
	ChannelName string
	Group       string
	IsStream    bool
	RequestPath string
	StartedAt   int64 // Unix seconds; the downstream request start time
}

type pendingLogEntry struct {
	requestId   string
	userId      int
	username    string
	tokenId     int
	tokenName   string
	modelName   string
	channelId   int
	channelName string
	group       string
	isStream    bool
	requestPath string
	startedAt   int64
}

// pendingLogs is per-process: when several gateway instances serve the same
// deployment, each instance lists the requests it is handling.
var pendingLogs = struct {
	sync.Mutex
	entries map[string]*pendingLogEntry
}{
	entries: make(map[string]*pendingLogEntry),
}

// RegisterPendingLog adds or refreshes the in-flight entry for a downstream
// request. Retries call it again with the newly selected channel; the original
// start time and creation timestamp are kept.
func RegisterPendingLog(params PendingLogParams) {
	if params.RequestId == "" {
		return
	}
	now := time.Now()
	pendingLogs.Lock()
	defer pendingLogs.Unlock()
	prunePendingLogsLocked(now)

	entry, ok := pendingLogs.entries[params.RequestId]
	if !ok {
		entry = &pendingLogEntry{requestId: params.RequestId}
		pendingLogs.entries[params.RequestId] = entry
	}
	entry.userId = params.UserId
	entry.username = params.Username
	entry.tokenId = params.TokenId
	entry.tokenName = params.TokenName
	entry.modelName = params.ModelName
	entry.channelId = params.ChannelId
	entry.channelName = params.ChannelName
	entry.group = params.Group
	entry.isStream = params.IsStream
	entry.requestPath = params.RequestPath
	if entry.startedAt <= 0 {
		entry.startedAt = params.StartedAt
	}
	if entry.startedAt <= 0 {
		entry.startedAt = now.Unix()
	}
}

// FinishPendingLog removes the in-flight entry once the request has completed
// and its final log row has been written.
func FinishPendingLog(requestId string) {
	if requestId == "" {
		return
	}
	pendingLogs.Lock()
	delete(pendingLogs.entries, requestId)
	pendingLogs.Unlock()
}

// ListPendingLogs returns in-flight logs matching the usage-log search. A zero
// userId means every user (administrator view).
func ListPendingLogs(filter LogFilter, userId int) []*Log {
	now := time.Now()
	pendingLogs.Lock()
	defer pendingLogs.Unlock()
	prunePendingLogsLocked(now)

	logs := make([]*Log, 0, len(pendingLogs.entries))
	for _, entry := range pendingLogs.entries {
		if userId != 0 && entry.userId != userId {
			continue
		}
		if !entry.matchesFilter(filter) {
			continue
		}
		logs = append(logs, entry.toLog(now))
	}
	slices.SortFunc(logs, func(a, b *Log) int {
		return cmp.Compare(b.CreatedAt, a.CreatedAt)
	})
	return logs
}

func prunePendingLogsLocked(now time.Time) {
	for requestId, entry := range pendingLogs.entries {
		if now.Unix()-entry.startedAt > int64(pendingLogTTL/time.Second) {
			delete(pendingLogs.entries, requestId)
		}
	}
}

func (e *pendingLogEntry) matchesFilter(filter LogFilter) bool {
	if filter.Type != LogTypeUnknown && filter.Type != LogTypeConsume {
		return false
	}
	if !matchesLogTextFilter(e.modelName, filter.ModelName) {
		return false
	}
	if !matchesLogTextFilter(e.username, filter.Username) {
		return false
	}
	if filter.TokenName != "" && e.tokenName != filter.TokenName {
		return false
	}
	if filter.RequestId != "" && e.requestId != filter.RequestId {
		return false
	}
	if filter.UpstreamRequestId != "" {
		return false
	}
	if filter.Channel != 0 && e.channelId != filter.Channel {
		return false
	}
	if filter.Group != "" && e.group != filter.Group {
		return false
	}
	if filter.StartTimestamp != 0 && e.startedAt < filter.StartTimestamp {
		return false
	}
	if filter.EndTimestamp != 0 && e.startedAt > filter.EndTimestamp {
		return false
	}
	return true
}

// matchesLogTextFilter mirrors the SQL filter semantics: a value without '%'
// is compared exactly, and '%' matches any run of characters.
func matchesLogTextFilter(value string, filter string) bool {
	if filter == "" {
		return true
	}
	if !strings.Contains(filter, "%") {
		return value == filter
	}
	parts := strings.Split(filter, "%")
	if !strings.HasPrefix(value, parts[0]) {
		return false
	}
	value = value[len(parts[0]):]
	for _, part := range parts[1 : len(parts)-1] {
		index := strings.Index(value, part)
		if index < 0 {
			return false
		}
		value = value[index+len(part):]
	}
	return strings.HasSuffix(value, parts[len(parts)-1])
}

func (e *pendingLogEntry) toLog(now time.Time) *Log {
	elapsedMs := max(now.UnixMilli()-e.startedAt*1000, 0)
	other := NewLogOther()
	// While the request is in flight the first-token latency and duration are
	// both the elapsed time: neither is known until the request completes.
	other.SetPublic("frt", float64(elapsedMs))
	if e.requestPath != "" {
		other.SetPublic("request_path", e.requestPath)
	}
	return &Log{
		Id:          pendingLogDisplayId(e.requestId),
		UserId:      e.userId,
		Username:    e.username,
		CreatedAt:   e.startedAt,
		Type:        LogTypeConsume,
		TokenName:   e.tokenName,
		ModelName:   e.modelName,
		UseTime:     int(elapsedMs / 1000),
		IsStream:    e.isStream,
		ChannelId:   e.channelId,
		ChannelName: e.channelName,
		TokenId:     e.tokenId,
		Group:       e.group,
		RequestId:   e.requestId,
		Other:       other.JSONString(),
		Pending:     true,
	}
}

// pendingLogDisplayId gives each in-flight row a stable negative row id so the
// table does not remount it on every refresh.
func pendingLogDisplayId(requestId string) int {
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(requestId))
	return -int(hash.Sum32()) - 1
}
