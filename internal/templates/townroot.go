package templates

import (
	_ "embed"
	"strings"

	"github.com/steveyegge/gastown/internal/cli"
)

//go:embed townroot/claude.md
var townRootCLAUDEmdRaw string

//go:embed townroot/gt.md
var townRootGTmdRaw string

// TownRootCLAUDEmdVersion is the version of the embedded town-root CLAUDE.md.
// Increment this when updating the template content with new sections.
const TownRootCLAUDEmdVersion = 1

// TownRootGTmdVersion is the version of the embedded town-root GT.md.
const TownRootGTmdVersion = 1

// TownRootCLAUDEmd returns the canonical town-root CLAUDE.md content
// with the CLI command name substituted.
func TownRootCLAUDEmd() string {
	return strings.ReplaceAll(townRootCLAUDEmdRaw, "{{cmd}}", cli.Name())
}

// TownRootGTmd returns the canonical town-root GT.md content
// with the CLI command name substituted.
func TownRootGTmd() string {
	return strings.ReplaceAll(townRootGTmdRaw, "{{cmd}}", cli.Name())
}

// TownRootRequiredSection describes a section that must be present in the town-root CLAUDE.md.
type TownRootRequiredSection struct {
	Name    string // Human-readable name for reporting
	Heading string // The H2 or H3 heading to look for
}

// TownRootRequiredSections returns the key sections that must be present
// in the town-root CLAUDE.md for proper agent behavior.
func TownRootRequiredSections() []TownRootRequiredSection {
	return []TownRootRequiredSection{
		{
			Name:    "Dolt awareness",
			Heading: "## Dolt Server",
		},
		{
			Name:    "Communication hygiene",
			Heading: "### Communication hygiene",
		},
	}
}
