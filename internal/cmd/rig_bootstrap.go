package cmd

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/steveyegge/gastown/internal/bootstrap"
	"github.com/steveyegge/gastown/internal/harness"
	"github.com/steveyegge/gastown/internal/style"
	"github.com/steveyegge/gastown/internal/ui"
)

var (
	bootstrapRefresh bool
	bootstrapDryRun  bool
	bootstrapYes     bool
)

var rigBootstrapCmd = &cobra.Command{
	Use:   "bootstrap [rig-name]",
	Short: "Analyze a rig's codebase and configure GT for agents",
	Long: `Scan a rig's repository to discover build system, CI config, docs, lint
configs, and test structure. Automatically populates:

  - settings/config.json  (build, test, lint, typecheck, setup commands)
  - .gastown/harness.yaml (tiered verification gates)
  - AGENTS.md             (pointers to discovered docs and verification)
  - CODEBASE_MAP.md       (directory structure overview)

Safe to run repeatedly: fills gaps, warns on conflicts, never overwrites
manual customizations.

Flags:
  --refresh   Force full re-scan (still prompts on conflicts)
  --dry-run   Show what would change without writing anything
  --yes       Non-interactive: accept all discovered values`,
	Args: cobra.MaximumNArgs(1),
	RunE: runRigBootstrap,
}

func runRigBootstrap(cmd *cobra.Command, args []string) error {
	// Resolve rig.
	var rigName string
	if len(args) > 0 {
		rigName = args[0]
	} else {
		roleInfo, err := GetRole()
		if err != nil {
			return fmt.Errorf("detecting rig from current directory: %w", err)
		}
		if roleInfo.Rig == "" {
			return fmt.Errorf("could not detect rig from current directory; please specify rig name")
		}
		rigName = roleInfo.Rig
	}

	_, r, err := getRig(rigName)
	if err != nil {
		return err
	}

	// The refinery clone is the canonical main checkout to scan.
	repoRoot := filepath.Join(r.Path, "refinery", "rig")

	if bootstrapDryRun {
		fmt.Printf("%s Dry run — no files will be written\n\n", ui.RenderInfoIcon())
	}

	// Step 1: Scan repo.
	fmt.Printf("%s Scanning %s...\n", style.SuccessPrefix, rigName)
	manifest, err := bootstrap.ScanRepo(repoRoot)
	if err != nil {
		return fmt.Errorf("scanning repo: %w", err)
	}
	printDiscovery(manifest)

	// Step 2: Parse CI / detect commands.
	ciCmds := harness.ParseCI(repoRoot)
	detectCmds := harness.DetectCommands(repoRoot)
	cmds := mergeCommands(ciCmds, detectCmds)
	printCommands(cmds)

	// Step 3: Wire config.
	wireResult, err := bootstrap.WireConfig(r.Path, cmds, manifest, bootstrap.WireOptions{
		DryRun: bootstrapDryRun,
		Yes:    bootstrapYes,
	})
	if err != nil {
		return fmt.Errorf("wiring config: %w", err)
	}
	printWireResult(wireResult)

	// Step 4: Generate AGENTS.md.
	genResult, err := bootstrap.GenerateAgentsMD(repoRoot, manifest, cmds, bootstrap.GenerateOptions{
		DryRun: bootstrapDryRun,
	})
	if err != nil {
		return fmt.Errorf("generating AGENTS.md: %w", err)
	}
	printGenAction("AGENTS.md", genResult.AgentsMDAction)

	// Step 5: Generate CODEBASE_MAP.md.
	mapResult, err := bootstrap.GenerateCodebaseMap(repoRoot, manifest, bootstrap.GenerateOptions{
		DryRun: bootstrapDryRun,
	})
	if err != nil {
		return fmt.Errorf("generating CODEBASE_MAP.md: %w", err)
	}
	printGenAction("CODEBASE_MAP.md", mapResult.CodebaseMapAction)

	// Summary.
	fmt.Println()
	if bootstrapDryRun {
		fmt.Println("Dry run complete. Re-run without --dry-run to apply changes.")
	} else {
		fmt.Printf("Agents working on %s will now get correct build/test/lint commands.\n", style.Bold.Render(rigName))
	}

	return nil
}

// mergeCommands overlays CI-parsed commands onto convention-detected commands.
// CI takes priority for any non-empty field.
func mergeCommands(ci, detect harness.Commands) harness.Commands {
	merged := detect
	if ci.Build != "" {
		merged.Build = ci.Build
	}
	if ci.Test != "" {
		merged.Test = ci.Test
	}
	if ci.Lint != "" {
		merged.Lint = ci.Lint
	}
	if ci.Typecheck != "" {
		merged.Typecheck = ci.Typecheck
	}
	if ci.Setup != "" {
		merged.Setup = ci.Setup
	}
	return merged
}

func printDiscovery(m *bootstrap.Manifest) {
	byType := make(map[bootstrap.ArtifactType][]bootstrap.Artifact)
	for _, a := range m.Artifacts {
		byType[a.Type] = append(byType[a.Type], a)
	}

	labels := []struct {
		t     bootstrap.ArtifactType
		label string
	}{
		{bootstrap.TypeCIConfig, "CI config"},
		{bootstrap.TypeBuildFile, "Build file"},
		{bootstrap.TypeDoc, "Documentation"},
		{bootstrap.TypeLintConfig, "Lint config"},
		{bootstrap.TypeFmtConfig, "Format config"},
		{bootstrap.TypeTestConfig, "Test config"},
		{bootstrap.TypeTestDir, "Test directory"},
		{bootstrap.TypeAgentDoc, "Agent doc"},
	}

	for _, l := range labels {
		arts := byType[l.t]
		if len(arts) == 0 {
			continue
		}
		names := make([]string, len(arts))
		for i, a := range arts {
			if a.Detail != "" {
				names[i] = fmt.Sprintf("%s (%s)", a.Path, a.Detail)
			} else {
				names[i] = a.Path
			}
		}
		fmt.Printf("  %s %s: %s\n", ui.RenderPassIcon(), l.label, strings.Join(names, ", "))
	}
}

func printCommands(cmds harness.Commands) {
	if cmds == (harness.Commands{}) {
		fmt.Printf("  %s No build/test commands detected\n", ui.RenderWarnIcon())
		return
	}
	fmt.Printf("%s Extracted commands:\n", style.SuccessPrefix)
	if cmds.Setup != "" {
		fmt.Printf("  setup=%s\n", cmds.Setup)
	}
	if cmds.Build != "" {
		fmt.Printf("  build=%s\n", cmds.Build)
	}
	if cmds.Test != "" {
		fmt.Printf("  test=%s\n", cmds.Test)
	}
	if cmds.Lint != "" {
		fmt.Printf("  lint=%s\n", cmds.Lint)
	}
	if cmds.Typecheck != "" {
		fmt.Printf("  typecheck=%s\n", cmds.Typecheck)
	}
}

func printWireResult(wr *bootstrap.WireResult) {
	for _, c := range wr.Changes {
		switch c.Action {
		case "set":
			fmt.Printf("  %s %s = %s\n", ui.RenderPassIcon(), c.Field, c.New)
		case "conflict":
			fmt.Printf("  %s %s: %s\n", ui.RenderWarnIcon(), c.Field, c.Reason)
		case "skip":
			fmt.Printf("  ○ %s (already set, matches)\n", c.Field)
		}
	}
	if wr.HarnessPath != "" {
		if wr.HarnessExists {
			fmt.Printf("  %s Updated %s\n", ui.RenderPassIcon(), wr.HarnessPath)
		} else {
			fmt.Printf("  %s Generated %s\n", ui.RenderPassIcon(), wr.HarnessPath)
		}
	}
}

func printGenAction(name, action string) {
	switch action {
	case "created":
		fmt.Printf("  %s Generated %s\n", ui.RenderPassIcon(), name)
	case "updated":
		fmt.Printf("  %s Updated %s\n", ui.RenderPassIcon(), name)
	case "skipped":
		fmt.Printf("  ○ %s (already exists, no changes)\n", name)
	}
}
