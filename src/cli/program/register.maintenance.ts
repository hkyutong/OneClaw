import type { Command } from "commander";
import { dashboardCommand } from "../../commands/dashboard.js";
import { doctorCommand } from "../../commands/doctor.js";
import { resetCommand } from "../../commands/reset.js";
import { uninstallCommand } from "../../commands/uninstall.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerMaintenanceCommands(program: Command) {
  program
    .command("doctor")
    .description("健康检查与常见修复")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/doctor", "docs.openclaw.ai/cli/doctor")}\n`,
    )
    .option("--no-workspace-suggestions", "关闭工作区记忆系统建议", false)
    .option("--yes", "直接接受默认项，不再询问", false)
    .option("--repair", "直接应用推荐修复，不再询问", false)
    .option("--fix", "应用推荐修复（--repair 的别名）", false)
    .option("--force", "执行更强的修复（可能覆盖自定义服务配置）", false)
    .option("--non-interactive", "无交互运行（仅安全迁移）", false)
    .option("--generate-gateway-token", "生成并配置 Gateway token", false)
    .option("--deep", "额外扫描系统服务中的其他 Gateway 安装", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await doctorCommand(defaultRuntime, {
          workspaceSuggestions: opts.workspaceSuggestions,
          yes: Boolean(opts.yes),
          repair: Boolean(opts.repair) || Boolean(opts.fix),
          force: Boolean(opts.force),
          nonInteractive: Boolean(opts.nonInteractive),
          generateGatewayToken: Boolean(opts.generateGatewayToken),
          deep: Boolean(opts.deep),
        });
        defaultRuntime.exit(0);
      });
    });

  program
    .command("dashboard")
    .description("使用当前 token 打开 Control UI")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/dashboard", "docs.openclaw.ai/cli/dashboard")}\n`,
    )
    .option("--no-open", "仅输出 URL，不自动打开浏览器")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await dashboardCommand(defaultRuntime, {
          noOpen: opts.open === false,
        });
      });
    });

  program
    .command("reset")
    .description("重置本地配置与状态（保留 CLI）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/reset", "docs.openclaw.ai/cli/reset")}\n`,
    )
    .option("--scope <scope>", "config|config+creds+sessions|full（默认：交互选择）")
    .option("--yes", "跳过确认提示", false)
    .option("--non-interactive", "关闭提示（需配合 --scope + --yes）", false)
    .option("--dry-run", "只打印操作，不删除文件", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await resetCommand(defaultRuntime, {
          scope: opts.scope,
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });

  program
    .command("uninstall")
    .description("卸载 Gateway 服务与本地数据（CLI 保留）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/uninstall", "docs.openclaw.ai/cli/uninstall")}\n`,
    )
    .option("--service", "移除 Gateway 服务", false)
    .option("--state", "移除状态与配置", false)
    .option("--workspace", "移除工作区目录", false)
    .option("--app", "移除 macOS App", false)
    .option("--all", "移除服务、状态、工作区和 App", false)
    .option("--yes", "跳过确认提示", false)
    .option("--non-interactive", "关闭提示（需配合 --yes）", false)
    .option("--dry-run", "只打印操作，不删除文件", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await uninstallCommand(defaultRuntime, {
          service: Boolean(opts.service),
          state: Boolean(opts.state),
          workspace: Boolean(opts.workspace),
          app: Boolean(opts.app),
          all: Boolean(opts.all),
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });
}
