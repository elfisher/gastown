package nudge

import (
	"testing"
	"time"
)

// TestEnqueue_DuplicateEventsNotThrottled is a NEGATIVE test proving that
// the nudge queue does not deduplicate identical events enqueued in rapid
// succession. Multiple GE_READY events from polecats finishing simultaneously
// all get enqueued, flooding the refinery's pane.
//
// EXPECTED AFTER FIX: identical events within a short window are collapsed
// into one. Queue length should be 1, not 5.
func TestEnqueue_DuplicateEventsNotThrottled(t *testing.T) {
	townRoot := t.TempDir()
	session := "gt-refinery"

	// Enqueue 5 identical GE_READY nudges within 1 second
	for i := 0; i < 5; i++ {
		err := Enqueue(townRoot, session, QueuedNudge{
			Message:   "GE_READY: Merge request ready for processing",
			Sender:    "polecat",
			Timestamp: time.Now(),
		})
		if err != nil {
			t.Fatalf("enqueue %d failed: %v", i, err)
		}
	}

	pending, err := Pending(townRoot, session)
	if err != nil {
		t.Fatalf("checking pending: %v", err)
	}

	// NEGATIVE: all 5 are enqueued — no deduplication
	if pending != 5 {
		t.Errorf("expected 5 pending nudges (no dedup), got %d", pending)
	}

	// After fix:
	// if pending != 1 {
	//     t.Errorf("expected 1 pending nudge (duplicates collapsed), got %d", pending)
	// }
}
