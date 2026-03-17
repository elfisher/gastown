package web

import (
	"html/template"
	"strings"
	"testing"
)

func TestLinkify(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantLink bool   // expect at least one entity-link
		wantHref string // expected onclick target (substring)
	}{
		{
			name:     "simple bead ID",
			input:    "gt-abc12",
			wantLink: true,
			wantHref: "openIssueDetail('gt-abc12')",
		},
		{
			name:     "convoy ID with cv prefix",
			input:    "hq-cv-xyz",
			wantLink: true,
			wantHref: "openConvoyDetail('hq-cv-xyz')",
		},
		{
			name:     "bead ID in sentence",
			input:    "Slung gt-9e5 to furiosa",
			wantLink: true,
			wantHref: "openIssueDetail('gt-9e5')",
		},
		{
			name:     "multiple bead IDs",
			input:    "Issues gt-abc and gt-def are ready",
			wantLink: true,
			wantHref: "openIssueDetail('gt-abc')",
		},
		{
			name:     "bead ID with dots",
			input:    "ap-qtsup.16",
			wantLink: true,
			wantHref: "openIssueDetail('ap-qtsup.16')",
		},
		{
			name:     "beads prefix bead ID",
			input:    "beads-xyz",
			wantLink: true,
			wantHref: "openIssueDetail('beads-xyz')",
		},
		{
			name:     "multi-segment convoy ID",
			input:    "hq-cv-abc12",
			wantLink: true,
			wantHref: "openConvoyDetail('hq-cv-abc12')",
		},
		{
			name:     "no bead ID — plain text",
			input:    "Hello world",
			wantLink: false,
		},
		{
			name:     "no bead ID — uppercase",
			input:    "GT-ABC",
			wantLink: false,
		},
		{
			name:     "no bead ID — number only prefix",
			input:    "123-abc",
			wantLink: false,
		},
		{
			name:     "HTML special chars are escaped",
			input:    "<script>gt-abc</script>",
			wantLink: true,
			wantHref: "openIssueDetail('gt-abc')",
		},
		{
			name:     "bd prefix bead ID",
			input:    "bd-ka761",
			wantLink: true,
			wantHref: "openIssueDetail('bd-ka761')",
		},
		{
			name:     "wisp molecule ID",
			input:    "gt-wisp-nrx0",
			wantLink: true,
			wantHref: "openIssueDetail('gt-wisp-nrx0')",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Linkify(tt.input)
			gotStr := string(got)

			hasLink := strings.Contains(gotStr, "entity-link")
			if hasLink != tt.wantLink {
				t.Errorf("Linkify(%q) has link=%v, want %v\nGot: %s", tt.input, hasLink, tt.wantLink, gotStr)
			}

			if tt.wantHref != "" && !strings.Contains(gotStr, tt.wantHref) {
				t.Errorf("Linkify(%q) missing href %q\nGot: %s", tt.input, tt.wantHref, gotStr)
			}

			// Verify HTML escaping: no raw < or > from input
			if strings.Contains(tt.input, "<") {
				if strings.Contains(gotStr, "<script>") {
					t.Errorf("Linkify(%q) did not escape HTML\nGot: %s", tt.input, gotStr)
				}
			}

			// Verify return type is template.HTML
			var _ template.HTML = got
		})
	}
}

func TestLinkifyMultipleIDs(t *testing.T) {
	got := string(Linkify("Issues gt-abc and hq-cv-def are tracked"))
	if count := strings.Count(got, "entity-link"); count != 2 {
		t.Errorf("expected 2 entity-links, got %d\nOutput: %s", count, got)
	}
	if !strings.Contains(got, "openIssueDetail('gt-abc')") {
		t.Error("missing issue link for gt-abc")
	}
	if !strings.Contains(got, "openConvoyDetail('hq-cv-def')") {
		t.Error("missing convoy link for hq-cv-def")
	}
}

func TestLinkifyPreservesNonIDText(t *testing.T) {
	input := "No IDs here, just plain text."
	got := string(Linkify(input))
	if got != "No IDs here, just plain text." {
		t.Errorf("Linkify should not modify text without IDs\nGot: %s", got)
	}
}
