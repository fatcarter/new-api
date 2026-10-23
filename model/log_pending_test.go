package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListPendingLogsMergesInFlightRequests(t *testing.T) {
	requestId := "pending-log-test-in-flight"
	startedAt := time.Now().Add(-5 * time.Second).Unix()
	RegisterPendingLog(PendingLogParams{
		RequestId:   requestId,
		UserId:      7,
		Username:    "alice",
		TokenId:     3,
		TokenName:   "ci-token",
		ModelName:   "gpt-4o",
		ChannelId:   11,
		ChannelName: "primary",
		Group:       "default",
		IsStream:    true,
		RequestPath: "/v1/chat/completions",
		StartedAt:   startedAt,
	})
	t.Cleanup(func() { FinishPendingLog(requestId) })

	logs := ListPendingLogs(LogFilter{}, 7)
	require.Len(t, logs, 1)
	log := logs[0]
	assert.True(t, log.Pending)
	assert.Equal(t, LogTypeConsume, log.Type)
	assert.Equal(t, "gpt-4o", log.ModelName)
	assert.Equal(t, "primary", log.ChannelName)
	assert.Equal(t, startedAt, log.CreatedAt)
	assert.GreaterOrEqual(t, log.UseTime, 5)
	assert.Negative(t, log.Id)
	assert.Contains(t, log.Other, `"frt"`)
	assert.Contains(t, log.Other, `"request_path"`)

	assert.Empty(t, ListPendingLogs(LogFilter{}, 8))
	assert.Empty(t, ListPendingLogs(LogFilter{Type: LogTypeError}, 7))
	assert.Empty(t, ListPendingLogs(LogFilter{ModelName: "claude%"}, 7))
	assert.Len(t, ListPendingLogs(LogFilter{ModelName: "gpt-4%"}, 7), 1)
	assert.Len(t, ListPendingLogs(LogFilter{Channel: 11, TokenName: "ci-token"}, 7), 1)

	FinishPendingLog(requestId)
	assert.Empty(t, ListPendingLogs(LogFilter{}, 7))
}

func TestRegisterPendingLogKeepsStartTimeAcrossRetries(t *testing.T) {
	requestId := "pending-log-test-retry"
	t.Cleanup(func() { FinishPendingLog(requestId) })
	firstStart := time.Now().Add(-10 * time.Second).Unix()
	params := PendingLogParams{RequestId: requestId, UserId: 7, ModelName: "gpt-4o", StartedAt: firstStart}
	RegisterPendingLog(params)

	params.ChannelId = 22
	params.ChannelName = "fallback"
	params.StartedAt = time.Now().Unix()
	RegisterPendingLog(params)

	logs := ListPendingLogs(LogFilter{}, 7)
	require.Len(t, logs, 1)
	assert.Equal(t, firstStart, logs[0].CreatedAt)
	assert.Equal(t, 22, logs[0].ChannelId)
}
