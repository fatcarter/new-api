package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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
	assert.Equal(t, PendingStageWaiting, log.PendingStage)
	assert.Contains(t, log.Other, `"pending_elapsed_ms"`)
	assert.NotContains(t, log.Other, `"frt"`)
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

func TestMarkPendingLogFirstByteStartsStreamingStage(t *testing.T) {
	requestId := "pending-log-test-first-byte"
	startedAt := time.Now().Add(-3 * time.Second).Unix()
	RegisterPendingLog(PendingLogParams{
		RequestId: requestId,
		UserId:    9,
		ModelName: "claude-sonnet",
		IsStream:  true,
		StartedAt: startedAt,
	})
	t.Cleanup(func() { FinishPendingLog(requestId) })

	waiting := ListPendingLogs(LogFilter{}, 9)
	require.Len(t, waiting, 1)
	require.Equal(t, PendingStageWaiting, waiting[0].PendingStage)

	MarkPendingLogFirstByte(requestId)
	streaming := ListPendingLogs(LogFilter{}, 9)
	require.Len(t, streaming, 1)
	assert.Equal(t, PendingStageStreaming, streaming[0].PendingStage)
	assert.Contains(t, streaming[0].Other, `"frt"`)

	// A later signal must not move the first-token latency.
	var streamingOther map[string]any
	require.NoError(t, common.UnmarshalJsonStr(streaming[0].Other, &streamingOther))
	firstFrt := streamingOther["frt"]
	MarkPendingLogFirstByte(requestId)
	again := ListPendingLogs(LogFilter{}, 9)
	require.Len(t, again, 1)
	var againOther map[string]any
	require.NoError(t, common.UnmarshalJsonStr(again[0].Other, &againOther))
	assert.Equal(t, firstFrt, againOther["frt"])
}
