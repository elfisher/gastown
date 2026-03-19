package nudge

import (
	"testing"
	"time"
)

// TestEnqueue_DeduplicatesIdenticalMessages verifies that identical nudges
// enqueued within the dedup window are collapsed into one.
func TestEnqueue_DeduplicatesIdenticalMessages(t *testing.T) {
	townRoot := t.TempDir()
	session := "gt-refinery"

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

	if pending != 1 {
		t.Errorf("expected 1 pending nudge (duplicates collapsed), got %d", pending)
	}
}

// TestEnqueue_AllowsDifferentMessages is a guard test verifying that
// dedup only collapses identical messages, not different ones.
func TestEnqueue_AllowsDifferentMessages(t *testing.T) {
	townRoot := t.TempDir()
	session := "gt-refinery"

	messages := []string{
		"GE_READY: MR from polecat-1",
		"GE_READY: MR from polecat-2",
		"PATROL: check status",
	}
	for _, msg := range messages {
		err := Enqueue(townRoot, session, QueuedNudge{
			Message:   msg,
			Sender:    "polecat",
			Timestamp: time.Now(),
		})
		if err != nil {
			t.Fatalf("enqueue %q failed: %v", msg, err)
		}
	}

	pending, err := Pending(townRoot, session)
	if err != nil {
		t.Fatalf("checking pending: %v", err)
	}

	if pending != 3 {
		t.Errorf("expected 3 pending nudges (different messages), got %d", pending)
	}
}

// TestEnqueue_AllowsSameMessageAfterWindow is a guard test verifying that
// the same message can be enqueued again after the dedup window expires.
func TestEnqueue_AllowsSameMessageAfterWindow(t *testing.T) {
	townRoot := t.TempDir()
	session := "gt-refinery"

	// First enqueue
	err := Enqueue(townRoot, session, QueuedNudge{
		Message:   "GE_READY: Merge request ready",
		Sender:    "polecat",
		Timestamp: time.Now().Add(-dedupWindow - time.Second), // outside window
	})
	if err != nil {
		t.Fatalf("first enqueue failed: %v", err)
	}

	// Second enqueue — same message but after the window
	err = Enqueue(townRoot, session, QueuedNudge{
		Message:   "GE_READY: Merge request ready",
		Sender:    "polecat",
		Timestamp: time.Now(),
	})
	if err != nil {
		t.Fatalf("second enqueue failed: %v", err)
	}

	pending, err := Pending(townRoot, session)
	if err != nil {
		t.Fatalf("checking pending: %v", err)
	}

	if pending != 2 {
		t.Errorf("expected 2 pending nudges (outside dedup window), got %d", pending)
	}
}
