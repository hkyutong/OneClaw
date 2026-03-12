import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";
import { createInstallPlan, type ReleaseChannel } from "@oneclaw/installer-core";
import yutoLogoUrl from "../../../yuto-macOS.png?url";
import {
  checkMacBackendHealth,
  fetchEmbeddedMacOnboarding,
  fetchMacDockerInstall,
  fetchMacGuidedSetup,
  fetchMacInspection,
  fetchMacSession,
  launchMacDashboardWithLocale,
  startMacGuidedSetup,
  launchMacDoctor,
  launchMacOnboarding,
  openMacFolder,
  performMacAction,
  sendEmbeddedMacOnboardingInput,
  startMacDockerInstall,
  startEmbeddedMacOnboarding,
  startMacInstall,
  stopEmbeddedMacOnboarding,
  type GuidedSetupSession,
  type GuidedProvider,
  type InstallSession,
  type MacCheck,
  type MacInspection,
  type OnboardingSession,
  type SystemAction
} from "./lib/macos-api.js";
import { detectLikelyPlatform, getPlatformLabel } from "./lib/platform.js";
import { getDesktopHostContext, getResolvedDesktopPlatform } from "./lib/host.js";

type Language = "zh" | "en";
type WizardStepId = "check" | "install" | "setup" | "verify";
type NoticeTone = "info" | "success" | "error";
type MacActionId = "privacy-security" | "docker-install" | "docker-open";

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

const INSTALL_CHANNEL: ReleaseChannel = "stable";
const API_PURCHASE_URL = "https://gptapi.asia";
const DEFAULT_MODEL_BY_PROVIDER: Record<GuidedProvider, string> = {
  yutoapi: "gpt-4o-mini",
  openai: "gpt-5.1-codex",
  anthropic: "claude-sonnet-4-6"
};
const OFFICIAL_DOCS = {
  zh: {
    auth: "https://docs.openclaw.ai/zh-CN/gateway/authentication",
    wizard: "https://github.com/hkyutong/OneClaw",
    docker: "https://github.com/hkyutong/OneClaw/blob/main/docker-setup.sh"
  },
  en: {
    auth: "https://docs.openclaw.ai/gateway/authentication",
    wizard: "https://github.com/hkyutong/OneClaw",
    docker: "https://github.com/hkyutong/OneClaw/blob/main/docker-setup.sh"
  }
} as const;

const COPY = {
  zh: {
    product: "OneClaw Installer",
    heading: "在 Mac 上安装 OneClaw",
    subtitle: "检查系统、准备安装资源、一键配置 OneClaw，再做最后验证。",
    languageLabel: "语言",
    unsupportedTitle: "当前先支持 macOS",
    unsupportedBody:
      "你现在打开的是 {platform}。当前 GUI 安装器已经完整验证的是 macOS 路线，所以这里会优先引导 macOS 用户。",
    steps: {
      check: "检查",
      install: "安装",
      setup: "设置",
      verify: "验证"
    },
    check: {
      kicker: "步骤 1",
      title: "检查这台 Mac 是否已准备好",
      introBlocked: "先把阻断项清掉，再进入安装。",
      introReady: "环境已经允许开始安装。",
      summaryReady: "已就绪",
      summaryAttention: "需留意",
      summaryBlocked: "阻断项",
      summaryDisk: "可用磁盘",
      refresh: "重新检查",
      start: "开始安装",
      blockedHint: "当前还不能开始安装。",
      offlineHint: "安装器离线，请重新打开应用。"
    },
    security: {
      title: "先允许这个 App 运行",
      body:
        "这个版本还没有开发者签名。第一次打开时，如果 macOS 提示无法验证或已被阻止，请到“系统设置 > 隐私与安全”里点“仍要打开”，然后回到这里继续。",
      openSettings: "打开“隐私与安全”",
      done: "我已允许打开此 App"
    },
    fixes: {
      installDocker: "一键安装 Docker Desktop",
      openDocker: "打开 Docker Desktop",
      openDockerDocs: "打开 Docker 官方安装文档",
      resolveBlocked: "一键处理当前阻断项"
    },
    tutorial: {
      title: "API 配置教程",
      intro:
        "最简单的方式是先准备一个 API Key，再在下面的一键配置中直接使用 YutoAPI。YutoAPI 已经被放在 OneClaw 提供商列表的首位，适合大多数用户。",
      stepOne: "先准备好 YutoAPI 的 API Key。",
      stepTwo: "模型 ID 保持推荐值，或者改成你想用的 YutoAPI 模型。",
      stepThree: "点击“一键配置 OneClaw”，应用会自动完成初始化和 Gateway 启动。",
      anthroHint: "YutoAPI 支持 OpenAI、Claude、Gemini、GLM、Qwen 等主流模型，通常不需要再单独配置多个提供商。",
      buyApi: "购买模型 API",
      openAuth: "打开官方 API 教程",
      openWizard: "打开 OneClaw 仓库",
      promoTitle: "推荐",
      promoBody: "如果你还没有可用的模型 API，可以先准备 YutoAPI，再继续安装流程。"
    },
    install: {
      kicker: "步骤 2",
      title: "准备 OneClaw 安装资源",
      introIdle: "点击开始后，应用会下载 OneClaw 安装资源，并准备后续设置入口。",
      introRunning: "正在准备 OneClaw 安装资源。",
      introDone: "安装资源已准备好，可以继续一键配置。",
      openAdvanced: "查看安装日志",
      continue: "继续",
      retry: "重新准备"
    },
    setup: {
      kicker: "步骤 3",
      title: "一键配置 OneClaw",
      intro: "填写 YutoAPI API Key 和模型 ID，然后让安装器自动完成 OneClaw 初始化与 Gateway 启动。",
      apiKeyLabel: "YutoAPI API Key",
      apiKeyPlaceholder: "粘贴 YutoAPI 发放的 API Key",
      modelLabel: "模型 ID",
      modelPlaceholder: "例如 gpt-4o-mini",
      baseUrlTitle: "固定接入地址",
      baseUrlBody: "安装器会自动使用 https://gptapi.asia/v1，无需手动填写 Base URL。",
      startGuided: "一键配置 OneClaw",
      retryGuided: "重新配置",
      runningTitle: "OneClaw 自动配置正在进行",
      progressTitle: "自动配置进度",
      progressIdle: "提交后，这里会显示 OneClaw 一键配置的实时步骤和日志。",
      advancedTitle: "改用官方终端流程",
      advancedBody:
        "如果自动配置失败，或者你想手动完成更复杂的选项，也可以切换到官方交互式 Docker 流程。",
      startEmbedded: "在应用内继续",
      startTerminal: "在 Terminal 中打开",
      inputPlaceholder: "如果官方流程需要输入内容，可在这里直接键入后发送",
      sendInput: "发送输入",
      stop: "停止当前会话",
      openAdvanced: "查看高级选项"
    },
    verify: {
      kicker: "步骤 4",
      title: "做最后验证",
      intro:
        "一键配置完成后，运行 Doctor 做最后验证。你也可以打开安装目录和日志目录查看具体文件。",
      openDashboard: "打开 OneClaw 图形界面",
      runDoctor: "运行 Doctor 验证",
      refresh: "刷新状态",
      openLogs: "打开日志目录",
      openHome: "打开安装目录",
      successTitle: "OneClaw 已准备就绪",
      successBody: "OneClaw 已经完成初始化并启动 Gateway。现在可以直接打开本地图形界面继续使用。"
    },
    actions: {
      checkAgain: "重新检查环境"
    },
    status: {
      installerChecking: "正在连接安装器",
      installerOnline: "安装器在线",
      installerOffline: "安装器离线",
      waiting: "等待中",
      running: "进行中",
      completed: "已完成",
      failed: "失败",
      ready: "已就绪",
      attention: "需留意",
      blocked: "阻断",
      onboardingIdle: "等待开始",
      onboardingRunning: "设置进行中",
      onboardingCompleted: "设置已完成",
      onboardingFailed: "设置失败",
      onboardingCancelled: "已停止"
    },
    notices: {
      info: "提示",
      success: "下一步已就绪",
      error: "需要处理",
      installStarted: "正在准备安装环境，请稍候。",
      installCompleted: "安装资源已经准备完成，继续一键配置 OneClaw。",
      guidedSetupStarted: "一键配置已经开始，正在初始化 OneClaw。",
      guidedSetupCompleted: "OneClaw 一键配置已经完成，现在可以做最后验证。",
      guidedSetupRetry: "可以修改参数后重新配置。",
      onboardingStarted: "官方设置已经在应用内启动。",
      onboardingTerminal: "官方设置已经在 Terminal 中打开。",
      onboardingCompleted: "官方设置已经完成，现在可以做最后验证。",
      onboardingCancelled: "应用内设置已停止。你可以重新开始，或改用 Terminal。",
      doctorOpened: "Doctor 已在 Terminal 中打开。请确认它没有报错。",
      dashboardOpened: "OneClaw 本地图形界面已经打开。",
      onboardingFallback: "如果当前机器更适合在 Terminal 中继续，也可以直接切换。"
      ,
      openingSecurity: "正在打开“隐私与安全”。",
      dockerInstalling: "正在下载并安装 Docker Desktop，请等系统授权窗口出现。",
      dockerOpening: "正在打开 Docker Desktop。"
    },
    quickKeys: {
      enter: "回车",
      space: "空格",
      tab: "Tab",
      prev: "上一个",
      next: "下一个",
      esc: "Esc"
    },
    details: {
      packageTitle: "安装摘要",
      systemTitle: "这台 Mac",
      sourceTitle: "参考资料",
      channel: "安装方式",
      targetVersion: "Docker 镜像",
      managedNode: "Docker 环境",
      installPath: "应用数据目录",
      systemVersion: "系统版本",
      architecture: "处理器架构",
      systemNode: "Docker Compose",
      managedOpenClaw: "OneClaw 工作区"
    }
  },
  en: {
    product: "OneClaw Installer",
    heading: "Install OneClaw on Mac",
    subtitle:
      "Check the system, prepare the install bundle, set up OneClaw automatically, and run the final verification.",
    languageLabel: "Language",
    unsupportedTitle: "macOS is the current priority",
    unsupportedBody:
      "You are running {platform}. The fully verified GUI installer path is currently macOS, so this build focuses on that experience first.",
    steps: {
      check: "Check",
      install: "Install",
      setup: "Set Up",
      verify: "Verify"
    },
    check: {
      kicker: "Step 1",
      title: "Check whether this Mac is ready",
      introBlocked: "Clear blocking issues before starting the install.",
      introReady: "This Mac is ready to start the install.",
      summaryReady: "Ready",
      summaryAttention: "Needs attention",
      summaryBlocked: "Blocked",
      summaryDisk: "Free disk",
      refresh: "Run checks again",
      start: "Start installation",
      blockedHint: "Installation cannot start yet.",
      offlineHint: "The local installer is offline. Reopen the app and try again."
    },
    security: {
      title: "Allow this app first",
      body:
        "This build is not developer-signed yet. If macOS says the app cannot be verified or was blocked, open System Settings > Privacy & Security, choose Open Anyway, then come back here.",
      openSettings: "Open Privacy & Security",
      done: "I already allowed this app"
    },
    fixes: {
      installDocker: "Install Docker Desktop",
      openDocker: "Open Docker Desktop",
      openDockerDocs: "Open Docker install docs",
      resolveBlocked: "Fix current blockers"
    },
    tutorial: {
      title: "API setup guide",
      intro:
        "The easiest path is to prepare a YutoAPI key first, then use it directly in the guided setup below. OneClaw now places YutoAPI first in the provider list for most users.",
      stepOne: "Prepare a YutoAPI API key.",
      stepTwo: "Keep the recommended model ID, or replace it with the YutoAPI model you want to use.",
      stepThree: "Click “Set up OneClaw” and let the installer finish initialization and gateway startup.",
      anthroHint:
        "YutoAPI covers OpenAI, Claude, Gemini, GLM, Qwen, and other mainstream model families through one gateway.",
      buyApi: "Buy model API",
      openAuth: "Open official API guide",
      openWizard: "Open OneClaw repository",
      promoTitle: "Recommended",
      promoBody: "If you do not have a usable model API yet, prepare YutoAPI first, then continue the installer."
    },
    install: {
      kicker: "Step 2",
      title: "Prepare the OneClaw install bundle",
      introIdle:
        "Once you start, the app downloads the OneClaw install bundle and prepares the setup entry points.",
      introRunning: "Preparing the OneClaw install bundle.",
      introDone: "The install bundle is ready. Continue to guided setup.",
      openAdvanced: "Show install logs",
      continue: "Continue",
      retry: "Prepare again"
    },
    setup: {
      kicker: "Step 3",
      title: "Set up OneClaw automatically",
      intro:
        "Paste your YutoAPI API key and model ID, then let the installer finish OneClaw initialization and gateway startup for you.",
      apiKeyLabel: "YutoAPI API key",
      apiKeyPlaceholder: "Paste the API key issued by YutoAPI",
      modelLabel: "Model ID",
      modelPlaceholder: "For example: gpt-4o-mini",
      baseUrlTitle: "Fixed endpoint",
      baseUrlBody: "The installer always uses https://gptapi.asia/v1. You do not need to enter a base URL.",
      startGuided: "Set up OneClaw",
      retryGuided: "Run setup again",
      runningTitle: "OneClaw guided setup is running",
      progressTitle: "Guided setup progress",
      progressIdle: "Once you submit the form, the live OneClaw setup steps and logs will appear here.",
      advancedTitle: "Switch to the official terminal flow",
      advancedBody:
        "If guided setup fails, or you need to adjust advanced options manually, you can still switch to the official interactive Docker flow.",
      startEmbedded: "Continue in the app",
      startTerminal: "Open in Terminal",
      inputPlaceholder:
        "If the official flow asks for input, type it here and send it directly",
      sendInput: "Send input",
      stop: "Stop this session",
      openAdvanced: "View advanced options"
    },
    verify: {
      kicker: "Step 4",
      title: "Run the final check",
      intro:
        "After guided setup is complete, run Doctor for the final check. You can also open the install folder and logs for troubleshooting.",
      openDashboard: "Open OneClaw UI",
      runDoctor: "Run Doctor",
      refresh: "Refresh status",
      openLogs: "Open logs folder",
      openHome: "Open install folder",
      successTitle: "OneClaw is ready",
      successBody: "OneClaw has been initialized and the gateway is running. You can open the local UI now and keep Doctor as an optional final check."
    },
    actions: {
      checkAgain: "Run checks again"
    },
    status: {
      installerChecking: "Connecting to installer",
      installerOnline: "Installer online",
      installerOffline: "Installer offline",
      waiting: "Waiting",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      ready: "Ready",
      attention: "Needs attention",
      blocked: "Blocked",
      onboardingIdle: "Waiting",
      onboardingRunning: "Setup in progress",
      onboardingCompleted: "Setup completed",
      onboardingFailed: "Setup failed",
      onboardingCancelled: "Stopped"
    },
    notices: {
      info: "Notice",
      success: "Ready for the next step",
      error: "Needs attention",
      installStarted:
        "Preparing the install environment. The app is downloading the official bundle and generating the setup entry points.",
      installCompleted:
        "The install bundle is ready. Continue to guided OneClaw setup.",
      guidedSetupStarted:
        "Guided setup has started. OneClaw is being initialized now.",
      guidedSetupCompleted:
        "Guided setup completed. You can now run the final verification.",
      guidedSetupRetry:
        "You can adjust the inputs and run the setup again.",
      onboardingStarted:
        "The official setup has started inside the app.",
      onboardingTerminal: "The official setup has opened in Terminal.",
      onboardingCompleted:
        "The official setup is complete. You can now run Doctor for the final validation.",
      onboardingCancelled:
        "The in-app setup session was stopped. You can start it again or continue in Terminal.",
      doctorOpened:
        "Doctor has opened in Terminal. Make sure it finishes without errors.",
      dashboardOpened:
        "The local OneClaw UI is open now.",
      onboardingFallback:
        "If Terminal is a better fit on this machine, continue there instead.",
      openingSecurity: "Opening Privacy & Security.",
      dockerInstalling: "Downloading and installing Docker Desktop. Approve the macOS prompt when it appears.",
      dockerOpening: "Opening Docker Desktop."
    },
    quickKeys: {
      enter: "Enter",
      space: "Space",
      tab: "Tab",
      prev: "Previous",
      next: "Next",
      esc: "Esc"
    },
    details: {
      packageTitle: "Install summary",
      systemTitle: "This Mac",
      sourceTitle: "References",
      channel: "Install mode",
      targetVersion: "Docker image",
      managedNode: "Docker environment",
      installPath: "App data path",
      systemVersion: "System version",
      architecture: "Architecture",
      systemNode: "Docker Compose",
      managedOpenClaw: "OneClaw workspace"
    }
  }
} as const;

function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem("oneclaw-installer-language") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function readStoredSecurityAcknowledged(): boolean {
  try {
    return window.localStorage.getItem("oneclaw-installer-security-acknowledged") === "true";
  } catch {
    return false;
  }
}

function App() {
  const host = getDesktopHostContext();
  const hostPlatform = getResolvedDesktopPlatform();
  const platform = hostPlatform ?? detectLikelyPlatform();
  const isMacHost = platform === "macos";
  const supportsEmbeddedOnboarding = isMacHost && host.capabilities.embeddedOnboarding;
  const plan = createInstallPlan({
    platform: isMacHost ? "macos" : platform,
    channel: INSTALL_CHANNEL,
    hasManagedNodeRuntime: false,
    hasWsl2: false
  });

  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [securityAcknowledged, setSecurityAcknowledged] = useState<boolean>(
    readStoredSecurityAcknowledged
  );
  const [backendState, setBackendState] = useState<"checking" | "online" | "offline">(
    "checking"
  );
  const [inspection, setInspection] = useState<MacInspection | null>(null);
  const [session, setSession] = useState<InstallSession | null>(null);
  const [guidedSetup, setGuidedSetup] = useState<GuidedSetupSession | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingSession | null>(null);
  const [dockerInstallAction, setDockerInstallAction] = useState<SystemAction | null>(null);
  const [guidedProvider, setGuidedProvider] = useState<GuidedProvider>("yutoapi");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_BY_PROVIDER.yutoapi);
  const [onboardingInput, setOnboardingInput] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const onboardingViewportRef = useRef<HTMLDivElement | null>(null);

  const text = COPY[language];
  const guidedProviderDetails = getGuidedProviderDetails(language, guidedProvider);

  useEffect(() => {
    try {
      window.localStorage.setItem("oneclaw-installer-language", language);
    } catch {
      // Ignore persistence failures in restricted environments.
    }
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "oneclaw-installer-security-acknowledged",
        securityAcknowledged ? "true" : "false"
      );
    } catch {
      // Ignore persistence failures in restricted environments.
    }
  }, [securityAcknowledged]);

  useEffect(() => {
    if (isMacHost) {
      void refreshInspection();
    }
  }, [isMacHost]);

  useEffect(() => {
    if (!session?.id || (session.status !== "running" && session.status !== "pending")) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchMacSession(session.id)
        .then((snapshot) => {
          startTransition(() => {
            setSession(snapshot);
            if (snapshot.inspection) {
              setInspection(snapshot.inspection);
            }
          });
        })
        .catch((error) => {
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!onboarding?.id || (onboarding.status !== "running" && onboarding.status !== "pending")) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchEmbeddedMacOnboarding(onboarding.id)
        .then((snapshot) => {
          startTransition(() => {
            setOnboarding(snapshot);
          });
        })
        .catch((error) => {
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        });
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [onboarding?.id, onboarding?.status]);

  useEffect(() => {
    if (!guidedSetup?.id || (guidedSetup.status !== "running" && guidedSetup.status !== "pending")) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchMacGuidedSetup(guidedSetup.id)
        .then((snapshot) => {
          startTransition(() => {
            setGuidedSetup(snapshot);
            if (snapshot.inspection) {
              setInspection(snapshot.inspection);
            }
          });
        })
        .catch((error) => {
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [guidedSetup?.id, guidedSetup?.status]);

  useEffect(() => {
    if (
      !dockerInstallAction?.id ||
      (dockerInstallAction.status !== "running" && dockerInstallAction.status !== "pending")
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchMacDockerInstall()
        .then((snapshot) => {
          startTransition(() => {
            setDockerInstallAction(snapshot);
          });
        })
        .catch(() => undefined);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [dockerInstallAction?.id, dockerInstallAction?.status]);

  useEffect(() => {
    if (session?.status === "completed") {
      setNotice({
        tone: "success",
        message: text.notices.installCompleted
      });
      void refreshInspection({ preserveNotice: true });
    }
  }, [session?.status, text.notices.installCompleted]);

  useEffect(() => {
    if (session?.status === "failed" && session.error) {
      setNotice({
        tone: "error",
        message: session.error
      });
    }
  }, [session?.status, session?.error]);

  useEffect(() => {
    if (!onboarding) {
      return;
    }

    if (onboarding.status === "completed") {
      setNotice({
        tone: "success",
        message: text.notices.onboardingCompleted
      });
      void refreshInspection({ preserveNotice: true });
      return;
    }

    if (onboarding.status === "failed" && onboarding.error) {
      setNotice({
        tone: "error",
        message: onboarding.error
      });
      return;
    }

    if (onboarding.status === "cancelled") {
      setNotice({
        tone: "info",
        message: text.notices.onboardingCancelled
      });
    }
  }, [onboarding, text.notices.onboardingCancelled, text.notices.onboardingCompleted]);

  useEffect(() => {
    if (!guidedSetup) {
      return;
    }

    if (guidedSetup.status === "completed") {
      setNotice({
        tone: "success",
        message: text.notices.guidedSetupCompleted
      });
      void refreshInspection({ preserveNotice: true });
      return;
    }

    if (guidedSetup.status === "failed" && guidedSetup.error) {
      setNotice({
        tone: "error",
        message: `${guidedSetup.error} ${text.notices.guidedSetupRetry}`
      });
    }
  }, [guidedSetup, text.notices.guidedSetupCompleted, text.notices.guidedSetupRetry]);

  useEffect(() => {
    if (!dockerInstallAction) {
      return;
    }

    if (dockerInstallAction.status === "running" || dockerInstallAction.status === "pending") {
      setNotice({
        tone: "info",
        message: dockerInstallAction.message
      });
      return;
    }

    if (dockerInstallAction.status === "completed") {
      setNotice({
        tone: "success",
        message: dockerInstallAction.message
      });
      window.setTimeout(() => {
        void refreshInspection({ preserveNotice: true });
      }, 1200);
      return;
    }

    if (dockerInstallAction.status === "failed") {
      setNotice({
        tone: "error",
        message: dockerInstallAction.error ?? dockerInstallAction.message
      });
    }
  }, [dockerInstallAction]);

  const deferredLogs = useDeferredValue(session?.logs ?? []);
  const deferredGuidedSetupLogs = useDeferredValue(guidedSetup?.logs ?? []);
  const deferredOnboardingOutput = useDeferredValue(
    sanitizeTerminalOutput(onboarding?.output ?? "")
  );

  useEffect(() => {
    const viewport = onboardingViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [deferredOnboardingOutput]);

  const checks = inspection?.checks ?? [];
  const blockedChecks = checks.filter((item) => item.state === "blocked");
  const attentionChecks = checks.filter((item) => item.state === "attention");
  const readyChecks = checks.filter((item) => item.state === "ready");
  const hasInstalledOpenClaw = Boolean(session?.result || inspection?.openclaw.installed);
  const canStartInstall =
    isMacHost &&
    backendState === "online" &&
    securityAcknowledged &&
    blockedChecks.length === 0 &&
    session?.status !== "running" &&
    session?.status !== "pending";
  const canLaunchOfficialSetup =
    isMacHost &&
    backendState === "online" &&
    hasInstalledOpenClaw &&
    session?.status !== "running" &&
    session?.status !== "pending";
  const guidedSetupRunning =
    guidedSetup?.status === "running" || guidedSetup?.status === "pending";
  const canStartGuidedSetup =
    canLaunchOfficialSetup &&
    blockedChecks.length === 0 &&
    !guidedSetupRunning &&
    providerApiKey.trim().length > 0;
  const isOnboardingActive =
    onboarding?.status === "running" || onboarding?.status === "pending";
  const setupCompleted = Boolean(
    inspection?.setupCompleted ||
      guidedSetup?.status === "completed" ||
      onboarding?.status === "completed"
  );
  const isDockerInstallRunning =
    dockerInstallAction?.status === "pending" || dockerInstallAction?.status === "running";
  const canRunDoctor = canLaunchOfficialSetup && setupCompleted;
  const progressPercent = resolveProgressPercent(session, hasInstalledOpenClaw);
  const primaryBlockerAction = resolvePrimaryBlockerAction(inspection, blockedChecks);
  const currentStep = resolveCurrentStep({
    backendState,
    blockedCount: blockedChecks.length,
    hasInstalledOpenClaw,
    session,
    guidedSetup,
    onboarding,
    setupCompleted
  });

  async function refreshInspection(
    options: {
      preserveNotice?: boolean;
    } = {}
  ): Promise<void> {
    if (!isMacHost) {
      return;
    }

    setBusyAction("inspect");
    if (!options.preserveNotice) {
      setNotice(null);
    }

    try {
      const online = await checkMacBackendHealth();
      setBackendState(online ? "online" : "offline");

      if (!online) {
        setInspection(null);
        return;
      }

      const nextInspection = await fetchMacInspection();
      startTransition(() => {
        setInspection(nextInspection);
      });
    } catch (error) {
      setBackendState("offline");
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleInstall(): Promise<void> {
    setBusyAction("install");
    setNotice({
      tone: "info",
      message: text.notices.installStarted
    });

    try {
      const nextSession = await startMacInstall(INSTALL_CHANNEL);
      setSession(nextSession);
      if (nextSession.inspection) {
        setInspection(nextSession.inspection);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartGuidedSetup(): Promise<void> {
    const apiKey = providerApiKey.trim();
    const nextModelId = modelId.trim() || guidedProviderDetails.defaultModelId;

    if (!apiKey) {
      setNotice({
        tone: "error",
        message:
          language === "zh"
            ? `请先填写 ${guidedProviderDetails.label} API Key。`
            : `Enter the ${guidedProviderDetails.label} API key first.`
      });
      return;
    }

    setBusyAction("guided-setup");
    setNotice({
      tone: "info",
      message: text.notices.guidedSetupStarted
    });

    try {
      const nextSession = await startMacGuidedSetup({
        provider: guidedProvider,
        apiKey,
        modelId: nextModelId
      });
      setGuidedSetup(nextSession);
      if (nextSession.inspection) {
        setInspection(nextSession.inspection);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLaunchOnboardingInTerminal(): Promise<void> {
    setBusyAction("onboard-terminal");
    setNotice(null);

    try {
      await launchMacOnboarding();
      setNotice({
        tone: "info",
        message: `${text.notices.onboardingTerminal} ${text.notices.onboardingFallback}`
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartEmbeddedOnboarding(): Promise<void> {
    setBusyAction("onboard-embedded");
    setNotice(null);

    try {
      const nextSession = await startEmbeddedMacOnboarding();
      setOnboarding(nextSession);
      setNotice({
        tone: "info",
        message: text.notices.onboardingStarted
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendOnboardingInput(input: string): Promise<void> {
    if (!onboarding?.id || !input) {
      return;
    }

    setBusyAction("onboard-input");

    try {
      const snapshot = await sendEmbeddedMacOnboardingInput(onboarding.id, input);
      setOnboarding(snapshot);
      if (input === "\r") {
        setOnboardingInput("");
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmitOnboardingText(): Promise<void> {
    const value = onboardingInput;
    if (!value.trim()) {
      return;
    }

    setOnboardingInput("");
    await handleSendOnboardingInput(`${value}\r`);
  }

  async function handleStopOnboarding(): Promise<void> {
    if (!onboarding?.id) {
      return;
    }

    setBusyAction("onboard-stop");

    try {
      const snapshot = await stopEmbeddedMacOnboarding(onboarding.id);
      setOnboarding(snapshot);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLaunchDoctor(): Promise<void> {
    setBusyAction("doctor");
    setNotice(null);

    try {
      await launchMacDoctor();
      setNotice({
        tone: "info",
        message: text.notices.doctorOpened
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLaunchDashboard(): Promise<void> {
    setBusyAction("dashboard");
    setNotice(null);

    try {
      const dashboardLocale = language === "zh" ? "zh-CN" : "en";
      await launchMacDashboardWithLocale(dashboardLocale);
      setNotice({
        tone: "success",
        message: text.notices.dashboardOpened
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenFolder(kind: "home" | "logs"): Promise<void> {
    setBusyAction(kind);

    try {
      await openMacFolder(kind);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMacAction(action: MacActionId): Promise<void> {
    const busyKey = `action-${action}`;
    setBusyAction(busyKey);

    if (action === "privacy-security") {
      setNotice({
        tone: "info",
        message: text.notices.openingSecurity
      });
    } else if (action === "docker-install") {
      setNotice({
        tone: "info",
        message: text.notices.dockerInstalling
      });
    } else {
      setNotice({
        tone: "info",
        message: text.notices.dockerOpening
      });
    }

    try {
      if (action === "docker-install") {
        const snapshot = await startMacDockerInstall();
        setDockerInstallAction(snapshot);
        return;
      }

      const result = await performMacAction(action);
      setNotice({
        tone: "success",
        message: result.message
      });
      if (action === "privacy-security") {
        return;
      }

      window.setTimeout(() => {
        void refreshInspection({ preserveNotice: true });
      }, 1500);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setBusyAction(null);
    }
  }

  function handleOpenExternal(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleGuidedProviderChange(nextProvider: GuidedProvider): void {
    setGuidedProvider(nextProvider);
    setProviderApiKey("");
    setModelId(DEFAULT_MODEL_BY_PROVIDER[nextProvider]);
    setNotice(null);
  }

  if (!isMacHost) {
    return (
      <main className="wizard-shell unsupported-shell">
        <div className="window-surface">
          <header className="window-toolbar">
            <div className="toolbar-spacer" aria-hidden="true" />
            <LanguageSwitch
              language={language}
              label={text.languageLabel}
              onChange={setLanguage}
            />
          </header>
          <section className="topbar unsupported-topbar">
            <div className="brand-row unsupported-brand-row">
              <img alt="OneClaw" className="app-logo" src={yutoLogoUrl} />
              <div className="brand-copy">
                <h1>{text.unsupportedTitle}</h1>
                <p className="hero-copy">
                  {text.unsupportedBody.replace("{platform}", getPlatformLabel(platform))}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="wizard-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <div className="window-surface">
        <header className="window-toolbar">
          <div className="toolbar-spacer" aria-hidden="true" />
          <LanguageSwitch
            language={language}
            label={text.languageLabel}
            onChange={setLanguage}
          />
        </header>

        <div className="window-content">
          <section className="topbar">
            <div className="hero-block">
              <div className="brand-row">
                <img alt="OneClaw" className="app-logo" src={yutoLogoUrl} />
                <div className="brand-copy">
                  <h1>{text.heading}</h1>
                  <p className="hero-copy">{text.subtitle}</p>
                </div>
              </div>
            </div>
          </section>

          {!securityAcknowledged ? (
            <section className="glass-card security-card">
              <div className="security-copy">
                <p className="section-kicker">{language === "zh" ? "开始前" : "Before you start"}</p>
                <h2>{text.security.title}</h2>
                <p>{text.security.body}</p>
              </div>
              <div className="action-row">
                <button
                  className="primary-cta"
                  disabled={busyAction === "action-privacy-security"}
                  onClick={() => {
                    void handleMacAction("privacy-security");
                  }}
                  type="button"
                >
                  {text.security.openSettings}
                </button>
                <button
                  className="secondary-cta"
                  onClick={() => {
                    setSecurityAcknowledged(true);
                  }}
                  type="button"
                >
                  {text.security.done}
                </button>
              </div>
            </section>
          ) : null}

          {notice ? (
            <section className={`glass-card notice-banner ${notice.tone}`}>
              <strong>{renderNoticeTitle(language, notice.tone)}</strong>
              <p>{notice.message}</p>
            </section>
          ) : null}

          <section className="glass-card step-rail">
            {(["check", "install", "setup", "verify"] as WizardStepId[]).map((stepId, index) => (
              <StepPill
                current={currentStep}
                index={index + 1}
                key={stepId}
                label={text.steps[stepId]}
                step={stepId}
              />
            ))}
          </section>

          <section className="glass-card wizard-panel">
            {currentStep === "check" ? (
              <div className="panel-stack">
            <header className="panel-header">
              <div>
                <p className="section-kicker">{text.check.kicker}</p>
                <h2>{text.check.title}</h2>
                <p className="panel-copy">
                  {backendState === "offline"
                    ? text.check.offlineHint
                    : blockedChecks.length > 0
                      ? text.check.introBlocked
                      : text.check.introReady}
                </p>
              </div>
              <span className={`status-chip ${backendState}`}>
                {renderBackendStateLabel(language, backendState)}
              </span>
            </header>

            <div className="metric-strip">
              <MetricTile label={text.check.summaryReady} value={String(readyChecks.length)} />
              <MetricTile
                label={text.check.summaryAttention}
                value={String(attentionChecks.length)}
              />
              <MetricTile
                label={text.check.summaryBlocked}
                value={String(blockedChecks.length)}
              />
              <MetricTile
                label={text.check.summaryDisk}
                value={inspection ? formatDisk(inspection.diskFreeBytes, language) : "--"}
              />
            </div>

            <div className="compact-list">
              {checks.map((item) => (
                <CheckCard
                  inspection={inspection}
                  item={item}
                  key={item.id}
                  language={language}
                />
              ))}
            </div>

            <div className="action-row">
              {primaryBlockerAction ? (
                <button
                  className="primary-cta"
                  disabled={
                    primaryBlockerAction === "docker-install"
                      ? isDockerInstallRunning
                      : busyAction === `action-${primaryBlockerAction}`
                  }
                  onClick={() => {
                    void handleMacAction(primaryBlockerAction);
                  }}
                  type="button"
                >
                  {primaryBlockerAction === "docker-install" && isDockerInstallRunning
                    ? language === "zh"
                      ? "正在下载 Docker Desktop..."
                      : "Downloading Docker Desktop..."
                    : text.fixes.resolveBlocked}
                </button>
              ) : null}
              {!primaryBlockerAction ? (
                <button
                  className="primary-cta"
                  disabled={!canStartInstall || busyAction !== null || isDockerInstallRunning}
                  onClick={() => {
                    void handleInstall();
                  }}
                  type="button"
                >
                  {text.check.start}
                </button>
              ) : null}
              <button
                className="secondary-cta"
                disabled={busyAction === "inspect"}
                onClick={() => {
                  void refreshInspection();
                }}
                type="button"
              >
                {text.check.refresh}
              </button>
            </div>

            {dockerInstallAction ? (
              <section className={`support-details docker-progress ${dockerInstallAction.status}`}>
                <div className="docker-progress-body">
                  <div className="row-between">
                    <strong>
                      {language === "zh" ? "Docker Desktop 安装状态" : "Docker Desktop install"}
                    </strong>
                    <span className={`state-chip ${renderSessionToneFromAction(dockerInstallAction.status)}`}>
                      {renderDockerActionStatusLabel(language, dockerInstallAction.status)}
                    </span>
                  </div>
                  <p className="details-copy">{dockerInstallAction.message}</p>
                  {typeof dockerInstallAction.progressPercent === "number" ? (
                    <div className="progress-bar subtle">
                      <div
                        className="progress-fill"
                        style={{ width: `${dockerInstallAction.progressPercent}%` }}
                      />
                    </div>
                  ) : null}
                  {dockerInstallAction.downloadedBytes ? (
                    <p className="details-copy">
                      {formatDownloadProgress(
                        dockerInstallAction.downloadedBytes,
                        dockerInstallAction.totalBytes,
                        language
                      )}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {currentStep === "install" ? (
          <div className="panel-stack">
            <header className="panel-header">
              <div>
                <p className="section-kicker">{text.install.kicker}</p>
                <h2>{text.install.title}</h2>
                <p className="panel-copy">
                  {session?.status === "completed"
                    ? text.install.introDone
                    : session
                      ? text.install.introRunning
                      : text.install.introIdle}
                </p>
              </div>
              <span className={`status-chip ${renderSessionTone(session?.status)}`}>
                {renderSessionStatusLabel(language, session?.status)}
              </span>
            </header>

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="compact-list">
              {(session?.steps ?? createFallbackSteps()).map((step) => (
                <article className={`install-card ${step.status}`} key={step.id}>
                  <div className="row-between">
                    <strong>{localizeInstallStepTitle(language, step.id)}</strong>
                    <span className={`state-chip ${step.status}`}>
                      {renderSessionStatusLabel(language, step.status)}
                    </span>
                  </div>
                  <p>{localizeInstallStepDetail(language, step, inspection)}</p>
                </article>
              ))}
            </div>

            <div className="action-row">
              <button
                className="primary-cta"
                disabled={!canLaunchOfficialSetup || busyAction !== null}
                onClick={() => {
                  void (supportsEmbeddedOnboarding
                    ? handleStartEmbeddedOnboarding()
                    : handleLaunchOnboardingInTerminal());
                }}
                type="button"
              >
                {session?.status === "failed"
                  ? text.install.retry
                  : text.install.continue}
              </button>
              <button
                className="secondary-cta"
                disabled={busyAction === "inspect"}
                onClick={() => {
                  void refreshInspection();
                }}
                type="button"
              >
                {text.actions.checkAgain}
              </button>
            </div>

            <details className="support-details">
              <summary>{text.install.openAdvanced}</summary>
              <div className="log-panel">
                {deferredLogs.length === 0 ? (
                  <p className="empty-copy">
                    {language === "zh" ? "日志会显示在这里。" : "Logs will appear here."}
                  </p>
                ) : (
                  deferredLogs.map((line, index) => (
                    <div className={`log-line ${line.level}`} key={`${line.at}-${index}`}>
                      <span>{line.at.slice(11, 19)}</span>
                      <code>{line.message}</code>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>
        ) : null}

        {currentStep === "setup" ? (
          <div className="panel-stack">
            <header className="panel-header">
              <div>
                <p className="section-kicker">{text.setup.kicker}</p>
                <h2>{text.setup.title}</h2>
                <p className="panel-copy">{guidedProviderDetails.intro}</p>
              </div>
              <span
                className={`status-chip ${
                  guidedSetup ? renderSessionTone(guidedSetup.status) : renderOnboardingTone(onboarding?.status)
                }`}
              >
                {guidedSetup
                  ? renderSessionStatusLabel(language, guidedSetup.status)
                  : renderOnboardingStatusLabel(language, onboarding?.status)}
              </span>
            </header>

            <section className="guide-card setup-form-card">
              <form
                className="setup-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleStartGuidedSetup();
                }}
              >
                <label className="form-field">
                  <span>{guidedProviderDetails.providerLabel}</span>
                  <div className="switch-segment provider-switch" role="tablist" aria-label={guidedProviderDetails.providerLabel}>
                    {(["yutoapi", "openai", "anthropic"] as GuidedProvider[]).map((provider) => (
                      <button
                        aria-selected={guidedProvider === provider}
                        className={guidedProvider === provider ? "active" : undefined}
                        disabled={guidedSetupRunning || busyAction === "guided-setup"}
                        key={provider}
                        onClick={() => {
                          handleGuidedProviderChange(provider);
                        }}
                        type="button"
                      >
                        {getGuidedProviderLabel(language, provider)}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="form-grid">
                  <label className="form-field">
                    <span>{guidedProviderDetails.apiKeyLabel}</span>
                    <input
                      autoComplete="off"
                      disabled={guidedSetupRunning || busyAction === "guided-setup"}
                      onChange={(event) => setProviderApiKey(event.target.value)}
                      placeholder={guidedProviderDetails.apiKeyPlaceholder}
                      type="password"
                      value={providerApiKey}
                    />
                  </label>
                  <label className="form-field">
                    <span>{text.setup.modelLabel}</span>
                    <input
                      autoCapitalize="none"
                      autoCorrect="off"
                      disabled={guidedSetupRunning || busyAction === "guided-setup"}
                      onChange={(event) => setModelId(event.target.value)}
                      placeholder={guidedProviderDetails.modelPlaceholder}
                      type="text"
                      value={modelId}
                    />
                  </label>
                </div>

                <div className="setup-hint-card">
                  <strong>{guidedProviderDetails.endpointTitle}</strong>
                  <p>{guidedProviderDetails.endpointBody}</p>
                </div>

                <div className="action-row">
                  <button
                    className="primary-cta"
                    disabled={!canStartGuidedSetup || busyAction === "guided-setup"}
                    type="submit"
                  >
                    {guidedSetup?.status === "failed" || inspection?.setupCompleted
                      ? text.setup.retryGuided
                      : text.setup.startGuided}
                  </button>
                  <button
                    className="secondary-cta"
                    disabled={busyAction === "inspect"}
                    onClick={() => {
                      void refreshInspection();
                    }}
                    type="button"
                  >
                    {text.verify.refresh}
                  </button>
                </div>
              </form>
            </section>

            <section className="glass-card">
              <div className="panel-header compact">
                <div>
                  <p className="section-kicker">{text.setup.kicker}</p>
                  <h3>{text.setup.progressTitle}</h3>
                </div>
                <span className={`status-chip ${renderSessionTone(guidedSetup?.status)}`}>
                  {renderSessionStatusLabel(language, guidedSetup?.status)}
                </span>
              </div>

              {guidedSetup ? (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${resolveProgressPercent(guidedSetup, guidedSetup.status === "completed")}%`
                      }}
                    />
                  </div>

                  <div className="compact-list">
                    {guidedSetup.steps.map((step) => (
                      <article className={`install-card ${step.status}`} key={step.id}>
                        <div className="row-between">
                          <strong>{localizeGuidedSetupStepTitle(language, step.id)}</strong>
                          <span className={`state-chip ${step.status}`}>
                            {renderSessionStatusLabel(language, step.status)}
                          </span>
                        </div>
                        <p>{localizeGuidedSetupStepDetail(language, step)}</p>
                      </article>
                    ))}
                  </div>

                  <details className="support-details" open>
                    <summary>{text.install.openAdvanced}</summary>
                    <div className="log-panel">
                      {deferredGuidedSetupLogs.length === 0 ? (
                        <p className="empty-copy">
                          {language === "zh"
                            ? "一键配置日志会显示在这里。"
                            : "Guided setup logs will appear here."}
                        </p>
                      ) : (
                        deferredGuidedSetupLogs.map((line, index) => (
                          <div className={`log-line ${line.level}`} key={`${line.at}-${index}`}>
                            <span>{line.at.slice(11, 19)}</span>
                            <code>{line.message}</code>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <p className="details-copy">{text.setup.progressIdle}</p>
              )}
            </section>

            <section className="guide-card">
              <div className="guide-header">
                <div>
                  <p className="section-kicker">{text.tutorial.promoTitle}</p>
                  <h3>{text.tutorial.title}</h3>
                </div>
                <img alt="Yuto" className="guide-badge" src={yutoLogoUrl} />
              </div>
              <p className="details-copy">{guidedProviderDetails.guideIntro}</p>
              <ol className="guide-list">
                {guidedProviderDetails.guideSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="details-copy">{guidedProviderDetails.guideHint}</p>
              <div className="promo-strip">
                <div>
                  <strong>{text.tutorial.promoTitle}</strong>
                  <p>{guidedProviderDetails.promoBody}</p>
                </div>
                <div className="action-row">
                  <button
                    className="primary-cta"
                    onClick={() => {
                      handleOpenExternal(API_PURCHASE_URL);
                    }}
                    type="button"
                  >
                    {text.tutorial.buyApi}
                  </button>
                  <button
                    className="secondary-cta"
                    onClick={() => {
                      handleOpenExternal(OFFICIAL_DOCS[language].auth);
                    }}
                    type="button"
                  >
                    {text.tutorial.openAuth}
                  </button>
                  <button
                    className="ghost-cta"
                    onClick={() => {
                      handleOpenExternal(OFFICIAL_DOCS[language].wizard);
                    }}
                    type="button"
                  >
                    {text.tutorial.openWizard}
                  </button>
                </div>
              </div>
            </section>

            <details className="support-details">
              <summary>{text.setup.openAdvanced}</summary>
              <p className="details-copy">{text.setup.advancedBody}</p>
              <div className="action-row">
                <button
                  className="secondary-cta"
                  disabled={
                    !canLaunchOfficialSetup ||
                    !supportsEmbeddedOnboarding ||
                    busyAction !== null ||
                    isOnboardingActive
                  }
                  onClick={() => {
                    void handleStartEmbeddedOnboarding();
                  }}
                  type="button"
                >
                  {text.setup.startEmbedded}
                </button>
                <button
                  className="ghost-cta"
                  disabled={!canLaunchOfficialSetup || busyAction === "onboard-terminal" || isOnboardingActive}
                  onClick={() => {
                    void handleLaunchOnboardingInTerminal();
                  }}
                  type="button"
                >
                  {text.setup.startTerminal}
                </button>
              </div>

              {onboarding ? (
                <div className="terminal-stack">
                  <div className="terminal-shell">
                    <div className="terminal-header">
                      <span className="traffic red" />
                      <span className="traffic yellow" />
                      <span className="traffic green" />
                      <strong>
                        {onboarding.status === "running"
                          ? language === "zh"
                            ? "官方设置正在进行"
                            : "Official setup is running"
                          : language === "zh"
                            ? "官方设置"
                            : "Official setup"}
                      </strong>
                    </div>

                    <div className="terminal-keys">
                      {getQuickKeys(language).map((item) => (
                        <button
                          className="terminal-key"
                          disabled={
                            !onboarding.id || onboarding.status !== "running" || busyAction === "onboard-input"
                          }
                          key={item.label}
                          onClick={() => {
                            void handleSendOnboardingInput(item.value);
                          }}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                      <button
                        className="terminal-key danger"
                        disabled={
                          !onboarding.id || onboarding.status !== "running" || busyAction === "onboard-stop"
                        }
                        onClick={() => {
                          void handleStopOnboarding();
                        }}
                        type="button"
                      >
                        {text.setup.stop}
                      </button>
                    </div>

                    <div className="terminal-screen" ref={onboardingViewportRef}>
                      <pre>
                        {deferredOnboardingOutput ||
                          (language === "zh"
                            ? "启动后，这里会显示官方 Docker 设置输出。"
                            : "The official Docker setup output will appear here once you start the setup flow.")}
                      </pre>
                    </div>
                  </div>

                  <form
                    className="input-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSubmitOnboardingText();
                    }}
                  >
                    <input
                      disabled={!onboarding.id || onboarding.status !== "running" || busyAction !== null}
                      onChange={(event) => setOnboardingInput(event.target.value)}
                      placeholder={text.setup.inputPlaceholder}
                      type="text"
                      value={onboardingInput}
                    />
                    <button
                      className="secondary-cta"
                      disabled={!onboardingInput.trim() || !onboarding.id || onboarding.status !== "running"}
                      type="submit"
                    >
                      {text.setup.sendInput}
                    </button>
                  </form>
                </div>
              ) : null}
            </details>
          </div>
        ) : null}

        {currentStep === "verify" ? (
          <div className="panel-stack">
            <header className="panel-header">
              <div>
                <p className="section-kicker">{text.verify.kicker}</p>
                <h2>{text.verify.title}</h2>
                <p className="panel-copy">{text.verify.intro}</p>
              </div>
              <span className="status-chip ready">{text.status.ready}</span>
            </header>

            <section className="success-card">
              <strong>{text.verify.successTitle}</strong>
              <p>{text.verify.successBody}</p>
              <div className="result-grid">
                <ResultItem
                  label={text.details.managedNode}
                  value={session?.result?.managedNodeVersion ?? inspection?.managedNode.version ?? "--"}
                />
                <ResultItem
                  label={text.details.targetVersion}
                  value={session?.result?.openclawVersion ?? inspection?.openclaw.version ?? "--"}
                />
              </div>
            </section>

            <div className="action-row">
              <button
                className="primary-cta"
                disabled={!setupCompleted || backendState !== "online" || busyAction === "dashboard"}
                onClick={() => {
                  void handleLaunchDashboard();
                }}
                type="button"
              >
                {text.verify.openDashboard}
              </button>
              <button
                className="secondary-cta"
                disabled={!canRunDoctor || busyAction === "doctor"}
                onClick={() => {
                  void handleLaunchDoctor();
                }}
                type="button"
              >
                {text.verify.runDoctor}
              </button>
              <button
                className="ghost-cta"
                disabled={busyAction === "inspect"}
                onClick={() => {
                  void refreshInspection();
                }}
                type="button"
              >
                {text.verify.refresh}
              </button>
              <button
                className="ghost-cta"
                disabled={backendState !== "online" || busyAction === "logs"}
                onClick={() => {
                  void handleOpenFolder("logs");
                }}
                type="button"
              >
                {text.verify.openLogs}
              </button>
              <button
                className="ghost-cta"
                disabled={backendState !== "online" || busyAction === "home"}
                onClick={() => {
                  void handleOpenFolder("home");
                }}
                type="button"
              >
                {text.verify.openHome}
              </button>
            </div>
          </div>
            ) : null}
          </section>

          <section className="glass-card support-panel">
            <details className="support-details">
              <summary>{text.details.packageTitle}</summary>
              <div className="detail-grid">
                <ResultItem label={text.details.channel} value="Docker" />
                <ResultItem
                  label={text.details.managedNode}
                  value={inspection?.managedNode.version ?? inspection?.latestNodeVersion ?? "--"}
                />
                <ResultItem
                  label={text.details.targetVersion}
                  value={inspection?.latestOpenClawVersion ?? "--"}
                />
                <ResultItem
                  label={text.details.installPath}
                  value={inspection?.paths.home ?? "~/Library/Application Support/OneClaw Installer"}
                />
              </div>
            </details>

            {inspection ? (
              <details className="support-details">
                <summary>{text.details.systemTitle}</summary>
                <div className="detail-grid">
                  <ResultItem label={text.details.systemVersion} value={`macOS ${inspection.osVersion}`} />
                  <ResultItem label={text.details.architecture} value={inspection.arch} />
                  <ResultItem
                    label={text.details.systemNode}
                    value={inspection.systemNode.installed ? inspection.systemNode.version ?? "--" : "--"}
                  />
                  <ResultItem
                    label={text.details.managedOpenClaw}
                    value={inspection.openclaw.installed ? inspection.openclaw.version ?? "--" : "--"}
                  />
                </div>
              </details>
            ) : null}

            <details className="support-details">
              <summary>{text.details.sourceTitle}</summary>
              <div className="source-list">
                {plan.sources.map((source) => (
                  <a
                    className="source-link"
                    href={source.url}
                    key={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <strong>{source.name}</strong>
                    <span>{source.reason}</span>
                  </a>
                ))}
              </div>
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}

function LanguageSwitch(props: {
  label: string;
  language: Language;
  onChange: (next: Language) => void;
}) {
  return (
    <div className="language-switch">
      <span>{props.label}</span>
      <div className="switch-segment">
        {(["zh", "en"] as Language[]).map((language) => (
          <button
            className={props.language === language ? "active" : undefined}
            key={language}
            onClick={() => props.onChange(language)}
            type="button"
          >
            {language === "zh" ? "中文" : "English"}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepPill(props: {
  step: WizardStepId;
  current: WizardStepId;
  index: number;
  label: string;
}) {
  const state = stepState(props.step, props.current);

  return (
    <article className={`step-pill ${state}`}>
      <span>{props.index}</span>
      <strong>{props.label}</strong>
    </article>
  );
}

function MetricTile(props: { label: string; value: string }) {
  return (
    <article className="metric-tile">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </article>
  );
}

function CheckCard(props: {
  language: Language;
  item: MacCheck;
  inspection: MacInspection | null;
}) {
  const usesIcon = isDockerRelatedCheck(props.item.id);

  return (
    <article className={`check-card ${props.item.state}`}>
      <div className="row-between check-card-heading">
        <div className="check-card-title">
          {usesIcon ? <img alt="" className="check-card-icon" src={yutoLogoUrl} /> : null}
          <strong>{localizeCheckTitle(props.language, props.item.id)}</strong>
        </div>
        <span className={`state-chip ${props.item.state}`}>
          {renderCheckStateLabel(props.language, props.item.state)}
        </span>
      </div>
      <p>{localizeCheckDetail(props.language, props.item, props.inspection)}</p>
    </article>
  );
}

function ResultItem(props: { label: string; value: string }) {
  return (
    <div className="result-item">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function resolveCurrentStep(input: {
  backendState: "checking" | "online" | "offline";
  blockedCount: number;
  hasInstalledOpenClaw: boolean;
  session: InstallSession | null;
  guidedSetup: GuidedSetupSession | null;
  onboarding: OnboardingSession | null;
  setupCompleted: boolean;
}): WizardStepId {
  if (input.backendState !== "online" || input.blockedCount > 0) {
    return "check";
  }

  if (
    !input.hasInstalledOpenClaw ||
    input.session?.status === "pending" ||
    input.session?.status === "running" ||
    input.session?.status === "failed"
  ) {
    return "install";
  }

  if (input.guidedSetup?.status === "pending" || input.guidedSetup?.status === "running") {
    return "setup";
  }

  if (input.onboarding?.status === "pending" || input.onboarding?.status === "running") {
    return "setup";
  }

  if (!input.setupCompleted) {
    return "setup";
  }

  return "verify";
}

function stepState(step: WizardStepId, current: WizardStepId): "done" | "active" | "upcoming" {
  const order: WizardStepId[] = ["check", "install", "setup", "verify"];
  const stepIndex = order.indexOf(step);
  const currentIndex = order.indexOf(current);

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "active";
  }

  return "upcoming";
}

function getQuickKeys(language: Language): Array<{ label: string; value: string }> {
  const quick = COPY[language].quickKeys;
  return [
    { label: quick.enter, value: "\r" },
    { label: quick.space, value: " " },
    { label: quick.tab, value: "\t" },
    { label: quick.prev, value: "\u001b[A" },
    { label: quick.next, value: "\u001b[B" },
    { label: quick.esc, value: "\u001b" }
  ];
}

function renderNoticeTitle(language: Language, tone: NoticeTone): string {
  const notices = COPY[language].notices;
  switch (tone) {
    case "info":
      return notices.info;
    case "success":
      return notices.success;
    case "error":
      return notices.error;
  }
}

function renderBackendStateLabel(
  language: Language,
  state: "checking" | "online" | "offline"
): string {
  const status = COPY[language].status;
  switch (state) {
    case "checking":
      return status.installerChecking;
    case "online":
      return status.installerOnline;
    case "offline":
      return status.installerOffline;
  }
}

function renderCheckStateLabel(language: Language, state: "ready" | "attention" | "blocked"): string {
  const status = COPY[language].status;
  switch (state) {
    case "ready":
      return status.ready;
    case "attention":
      return status.attention;
    case "blocked":
      return status.blocked;
  }
}

function renderSessionTone(
  status: InstallSession["status"]   | undefined
): "checking" | "ready" | "blocked" {
  switch (status) {
    case "completed":
      return "ready";
    case "failed":
      return "blocked";
    default:
      return "checking";
  }
}

function renderSessionToneFromAction(
  status: SystemAction["status"]
): "checking" | "ready" | "blocked" {
  switch (status) {
    case "completed":
      return "ready";
    case "failed":
      return "blocked";
    default:
      return "checking";
  }
}

function renderSessionStatusLabel(
  language: Language,
  status: InstallSession["status"]     | undefined
): string {
  const values = COPY[language].status;
  switch (status) {
    case "pending":
      return values.waiting;
    case "running":
      return values.running;
    case "completed":
      return values.completed;
    case "failed":
      return values.failed;
    default:
      return values.waiting;
  }
}

function renderOnboardingTone(
  status: OnboardingSession["status"] | undefined
): "checking" | "ready" | "blocked" | "attention" {
  switch (status) {
    case "completed":
      return "ready";
    case "failed":
      return "blocked";
    case "cancelled":
      return "attention";
    case "pending":
    case "running":
      return "checking";
    default:
      return "attention";
  }
}

function renderOnboardingStatusLabel(
  language: Language,
  status: OnboardingSession["status"] | undefined
): string {
  const values = COPY[language].status;
  switch (status) {
    case "pending":
      return values.waiting;
    case "running":
      return values.onboardingRunning;
    case "completed":
      return values.onboardingCompleted;
    case "failed":
      return values.onboardingFailed;
    case "cancelled":
      return values.onboardingCancelled;
    default:
      return values.onboardingIdle;
  }
}

function renderDockerActionStatusLabel(
  language: Language,
  status: SystemAction["status"]
): string {
  const isZh = language === "zh";
  switch (status) {
    case "completed":
      return isZh ? "已完成" : "Completed";
    case "failed":
      return isZh ? "失败" : "Failed";
    case "pending":
      return isZh ? "准备中" : "Preparing";
    default:
      return isZh ? "进行中" : "Running";
  }
}

function getGuidedProviderDetails(
  language: Language,
  provider: GuidedProvider
): {
  label: string;
  providerLabel: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  modelPlaceholder: string;
  defaultModelId: string;
  intro: string;
  endpointTitle: string;
  endpointBody: string;
  guideIntro: string;
  guideSteps: string[];
  guideHint: string;
  promoBody: string;
} {
  const label = getGuidedProviderLabel(language, provider);
  const isZh = language === "zh";
  const defaultModelId = DEFAULT_MODEL_BY_PROVIDER[provider];
  const providerLabel = isZh ? "API 提供商" : "API provider";

  if (provider === "openai") {
    return {
      label,
      providerLabel,
      apiKeyLabel: isZh ? "OpenAI API Key" : "OpenAI API key",
      apiKeyPlaceholder: isZh ? "粘贴 OpenAI 官方发放的 API Key" : "Paste the API key issued by OpenAI",
      modelPlaceholder: defaultModelId,
      defaultModelId,
      intro: isZh
        ? "选择 API 提供商，填入对应的 API Key 和模型 ID，然后让安装器自动完成 OneClaw 初始化与 Gateway 启动。"
        : "Choose a provider, enter the matching API key and model ID, then let the installer finish OneClaw initialization and gateway startup.",
      endpointTitle: isZh ? "连接方式" : "Connection",
      endpointBody: isZh
        ? "将直接连接 OpenAI 官方 API。模型 ID 留空时会自动回退到推荐默认值。"
        : "The installer connects directly to the official OpenAI API. Leave the model blank to use the recommended default.",
      guideIntro: isZh
        ? "如果你已经有 OpenAI 官方 API Key，可以直接在这里接入；也可以随时切回 YutoAPI 或 Claude 官方。"
        : "If you already have an official OpenAI API key, use it directly here. You can switch back to YutoAPI or Claude at any time.",
      guideSteps: isZh
        ? [
            "粘贴 OpenAI 官方 API Key。",
            `模型 ID 可保持默认值 ${defaultModelId}，或改成你自己的 OpenAI 模型。`,
            "点击“一键配置 OneClaw”，安装器会自动完成初始化和 Gateway 启动。"
          ]
        : [
            "Paste your official OpenAI API key.",
            `Keep the default model ${defaultModelId}, or replace it with your own OpenAI model.`,
            "Click “Set up OneClaw” and let the installer finish initialization and gateway startup."
          ],
      guideHint: isZh
        ? "如果你暂时没有 OpenAI 官方额度，也可以切换到 YutoAPI，通过同一入口接入更多模型。"
        : "If you do not have OpenAI credits yet, switch to YutoAPI for broader model coverage from one entry point.",
      promoBody: isZh
        ? "OpenAI 官方可直接接入；如果你还没有可用额度，也可以切回 YutoAPI。"
        : "OpenAI works directly here. If you do not have credits yet, you can switch back to YutoAPI."
    };
  }

  if (provider === "anthropic") {
    return {
      label,
      providerLabel,
      apiKeyLabel: isZh ? "Claude API Key" : "Claude API key",
      apiKeyPlaceholder: isZh ? "粘贴 Anthropic 官方发放的 API Key" : "Paste the API key issued by Anthropic",
      modelPlaceholder: defaultModelId,
      defaultModelId,
      intro: isZh
        ? "选择 API 提供商，填入对应的 API Key 和模型 ID，然后让安装器自动完成 OneClaw 初始化与 Gateway 启动。"
        : "Choose a provider, enter the matching API key and model ID, then let the installer finish OneClaw initialization and gateway startup.",
      endpointTitle: isZh ? "连接方式" : "Connection",
      endpointBody: isZh
        ? "将直接连接 Claude 官方 API。模型 ID 留空时会自动回退到推荐默认值。"
        : "The installer connects directly to the official Claude API. Leave the model blank to use the recommended default.",
      guideIntro: isZh
        ? "如果你已经有 Claude 官方 API Key，可以直接在这里接入；也可以随时切回 YutoAPI 或 OpenAI 官方。"
        : "If you already have an official Claude API key, use it directly here. You can switch back to YutoAPI or OpenAI at any time.",
      guideSteps: isZh
        ? [
            "粘贴 Anthropic 官方 API Key。",
            `模型 ID 可保持默认值 ${defaultModelId}，或改成你自己的 Claude 模型。`,
            "点击“一键配置 OneClaw”，安装器会自动完成初始化和 Gateway 启动。"
          ]
        : [
            "Paste your official Anthropic API key.",
            `Keep the default model ${defaultModelId}, or replace it with your own Claude model.`,
            "Click “Set up OneClaw” and let the installer finish initialization and gateway startup."
          ],
      guideHint: isZh
        ? "如果你想用更多模型家族，也可以切回 YutoAPI，通过同一个入口统一管理。"
        : "If you want access to more model families, switch to YutoAPI and manage them from one entry point.",
      promoBody: isZh
        ? "Claude 官方可直接接入；如果你还没有官方 key，也可以切回 YutoAPI。"
        : "Claude works directly here. If you do not have an official key yet, you can switch back to YutoAPI."
    };
  }

  return {
    label,
    providerLabel,
    apiKeyLabel: isZh ? "YutoAPI API Key" : "YutoAPI API key",
    apiKeyPlaceholder: isZh ? "粘贴 YutoAPI 发放的 API Key" : "Paste the API key issued by YutoAPI",
    modelPlaceholder: defaultModelId,
    defaultModelId,
    intro: isZh
      ? "选择 API 提供商，填入对应的 API Key 和模型 ID，然后让安装器自动完成 OneClaw 初始化与 Gateway 启动。"
      : "Choose a provider, enter the matching API key and model ID, then let the installer finish OneClaw initialization and gateway startup.",
    endpointTitle: isZh ? "固定接入地址" : "Fixed endpoint",
    endpointBody: isZh
      ? "安装器会自动使用 https://gptapi.asia/v1，无需手动填写 Base URL。"
      : "The installer always uses https://gptapi.asia/v1. You do not need to enter a base URL.",
    guideIntro: isZh
      ? "最简单的方式仍然是先准备 YutoAPI。它放在首位，适合大多数用户；如果你已经有 OpenAI 或 Claude 官方 key，也可以直接切换。"
      : "The easiest path is still YutoAPI. It stays first for most users, but you can switch to official OpenAI or Claude whenever you want.",
    guideSteps: isZh
      ? [
          "先准备好 YutoAPI 的 API Key。",
          `模型 ID 保持推荐值 ${defaultModelId}，或者改成你想用的 YutoAPI 模型。`,
          "点击“一键配置 OneClaw”，应用会自动完成初始化和 Gateway 启动。"
        ]
      : [
          "Prepare a YutoAPI API key.",
          `Keep the recommended model ${defaultModelId}, or replace it with the YutoAPI model you want to use.`,
          "Click “Set up OneClaw” and let the app finish initialization and gateway startup."
        ],
    guideHint: isZh
      ? "YutoAPI 支持 OpenAI、Claude、Gemini 以及国内外主流模型；如果你更想直连官方，也可以切换到 OpenAI 或 Claude。"
      : "YutoAPI covers OpenAI, Claude, Gemini, and other mainstream models. If you prefer direct official APIs, switch to OpenAI or Claude.",
    promoBody: isZh
      ? "如果你还没有可用的模型 API，可以先到 gptapi.asia 准备 YutoAPI；也可以改用 OpenAI 或 Claude 官方。"
      : "If you do not have a model API yet, start with YutoAPI at gptapi.asia, or switch to official OpenAI or Claude."
  };
}

function getGuidedProviderLabel(language: Language, provider: GuidedProvider): string {
  const labels = {
    zh: {
      yutoapi: "YutoAPI",
      openai: "OpenAI",
      anthropic: "Claude"
    },
    en: {
      yutoapi: "YutoAPI",
      openai: "OpenAI",
      anthropic: "Claude"
    }
  } as const;

  return labels[language][provider];
}

function resolvePrimaryBlockerAction(
  inspection: MacInspection | null,
  blockedChecks: MacCheck[]
): MacActionId | null {
  if (!inspection || blockedChecks.length === 0) {
    return null;
  }

  if (blockedChecks.some((item) => item.id === "docker" || item.id === "compose")) {
    return "docker-install";
  }

  if (blockedChecks.some((item) => item.id === "engine")) {
    return "docker-open";
  }

  return null;
}

function isDockerRelatedCheck(id: string): boolean {
  return id === "docker" || id === "compose" || id === "engine" || id === "workspace";
}

function localizeCheckTitle(language: Language, id: string): string {
  const map = {
    zh: {
      arch: "主机架构",
      disk: "可用磁盘空间",
      home: "安装目录可写",
      network: "官方源可达",
      docker: "Docker CLI",
      compose: "Docker Compose",
      engine: "Docker Engine",
      workspace: "Docker 工作区"
    },
    en: {
      arch: "Host architecture",
      disk: "Free disk space",
      home: "Install directory",
      network: "Official sources",
      docker: "Docker CLI",
      compose: "Docker Compose",
      engine: "Docker Engine",
      workspace: "Docker workspace"
    }
  } as const;

  return map[language][id as keyof typeof map.zh] ?? id;
}

function localizeCheckDetail(
  language: Language,
  item: MacCheck,
  inspection: MacInspection | null
): string {
  if (!inspection) {
    return item.detail;
  }

  const isZh = language === "zh";

  switch (item.id) {
    case "arch":
      return isZh
        ? `当前架构为 ${inspection.arch}。`
        : `Current architecture: ${inspection.arch}.`;
    case "disk":
      return isZh
        ? `当前可用 ${formatDisk(inspection.diskFreeBytes, language)}，建议至少 4 GB。`
        : `Currently ${formatDisk(inspection.diskFreeBytes, language)} free. At least 4 GB is recommended.`;
    case "home":
      return isZh
        ? `应用会把 Docker 相关文件、日志和工作目录放在 ${inspection.paths.home}。`
        : `The app will store Docker files, logs, and the workspace in ${inspection.paths.home}.`;
    case "network":
      if (inspection.openclaw.installed) {
        return isZh
          ? "本机已经准备好 OneClaw Docker 工作区，后续步骤不依赖重新下载官方源。"
          : "The OneClaw Docker workspace already exists locally, so the next steps no longer depend on downloading official sources again.";
      }

      if (item.state === "ready") {
        return isZh
          ? "GitHub 仓库与官方 Docker 安装包地址都可访问。"
          : "The GitHub repository and the official Docker bundle are both reachable.";
      }

      if (item.state === "attention") {
        return isZh
          ? "官方源目前只有一部分可访问。通常仍可继续准备安装资源，或稍后切换网络后再试。"
          : "Only part of the official sources is reachable right now. You can usually continue, or retry later on another network.";
      }

      return isZh
        ? "当前无法访问 GitHub 仓库与官方 Docker 安装包地址。"
        : "The GitHub repository and the official Docker bundle are both unreachable right now.";
    case "compose":
      return inspection.systemNode.installed
        ? isZh
          ? `已检测到 ${inspection.systemNode.version ?? "unknown"}。`
          : `Detected ${inspection.systemNode.version ?? "unknown"}.`
        : isZh
          ? "未检测到 Docker Compose。请先升级 Docker Desktop。"
          : "Docker Compose was not detected. Update Docker Desktop first.";
    case "docker":
      return inspection.managedNode.installed
        ? isZh
          ? `Docker CLI 已安装：${inspection.managedNode.version ?? "unknown"}。`
          : `Docker CLI is installed: ${inspection.managedNode.version ?? "unknown"}.`
        : isZh
          ? "未检测到 Docker CLI。请先安装并启动 Docker Desktop。"
          : "Docker CLI was not detected. Install and launch Docker Desktop first.";
    case "engine":
      return item.state === "ready"
        ? isZh
          ? "Docker Engine 正在运行。"
          : "Docker Engine is running."
        : isZh
          ? "Docker Engine 未运行。请先打开 Docker Desktop。"
          : "Docker Engine is not running. Open Docker Desktop first.";
    case "workspace":
      return inspection.openclaw.installed
        ? isZh
          ? `已检测到 OneClaw Docker 工作区：${inspection.openclaw.path ?? "OneClaw"}.`
          : `Detected the OneClaw Docker workspace at ${inspection.openclaw.path ?? "OneClaw"}.`
        : isZh
          ? `尚未准备，安装阶段会自动下载 ${inspection.latestOpenClawVersion}。`
          : `Not prepared yet. The installer will download ${inspection.latestOpenClawVersion}.`;
    default:
      return item.detail;
  }
}

function localizeInstallStepTitle(language: Language, id: string): string {
  const map = {
    zh: {
      inspect: "检查系统",
      runtime: "准备安装资源",
      openclaw: "生成 OneClaw 入口",
      verify: "核对官方文件",
      finalize: "完成准备"
    },
    en: {
      inspect: "Check system",
      runtime: "Prepare install bundle",
      openclaw: "Create OneClaw entry points",
      verify: "Verify official files",
      finalize: "Finish preparation"
    }
  } as const;

  return map[language][id as keyof typeof map.zh] ?? id;
}

function localizeInstallStepDetail(
  language: Language,
  step: InstallSession["steps"][number],
  inspection: MacInspection | null
): string {
  const isZh = language === "zh";

  if (step.status === "failed") {
    return step.detail ?? (isZh ? "安装失败。" : "Installation failed.");
  }

  switch (step.id) {
    case "inspect":
      return inspection
        ? isZh
          ? `已检查 macOS ${inspection.osVersion} 和 ${inspection.arch}。`
          : `Checked macOS ${inspection.osVersion} and ${inspection.arch}.`
        : isZh
          ? "正在检查本机环境。"
          : "Checking the local environment.";
    case "runtime":
      return step.status === "completed"
        ? isZh
          ? "官方安装资源已经准备完成。"
          : "The official install bundle is ready."
        : isZh
          ? "正在下载并整理官方安装资源。"
          : "Downloading and preparing the official install bundle.";
    case "openclaw":
      return step.status === "completed"
        ? isZh
          ? "官方设置入口和验证入口已经生成。"
          : "The setup and verification entry points are ready."
        : isZh
          ? "正在生成设置入口与验证入口。"
          : "Creating the setup and verification entry points.";
    case "verify":
      return step.status === "completed"
        ? isZh
          ? "已核对官方 Docker 文件与工作区。"
          : "The official Docker files and workspace were verified."
        : isZh
          ? "正在核对官方 Docker 文件与工作区。"
          : "Verifying the official Docker files and workspace.";
    case "finalize":
      return step.status === "completed"
        ? isZh
          ? "现在可以继续一键配置。"
          : "Everything is ready for guided setup."
        : isZh
          ? "正在收尾并保存入口。"
          : "Finalizing the setup entry points.";
    default:
      return step.detail ?? (isZh ? "等待执行。" : "Waiting to run.");
  }
}

function localizeGuidedSetupStepTitle(language: Language, id: string): string {
  const map = {
    zh: {
      inspect: "检查系统",
      prepare: "准备 Docker 工作区",
      configure: "写入模型配置",
      verify: "验证 Gateway 状态",
      finalize: "完成一键配置"
    },
    en: {
      inspect: "Check system",
      prepare: "Prepare Docker workspace",
      configure: "Write model configuration",
      verify: "Verify gateway status",
      finalize: "Finish guided setup"
    }
  } as const;

  return map[language][id as keyof typeof map.zh] ?? id;
}

function localizeGuidedSetupStepDetail(
  language: Language,
  step: GuidedSetupSession["steps"][number]
): string {
  const isZh = language === "zh";

  if (step.detail) {
    return step.detail;
  }

  switch (step.id) {
    case "inspect":
      return isZh ? "检查这台 Mac 是否已满足自动配置条件。" : "Checking whether this Mac is ready for guided setup.";
    case "prepare":
      return isZh ? "确保 OneClaw Docker 工作区和脚本已经准备好。" : "Making sure the OneClaw Docker workspace and scripts are ready.";
    case "configure":
      return isZh
        ? "将选定的 API Key 和模型写入 OneClaw，并执行无交互初始化。"
        : "Writing the selected API key and model into OneClaw, then running non-interactive onboarding.";
    case "verify":
      return isZh ? "等待 OneClaw Gateway 启动并通过健康检查。" : "Waiting for the OneClaw gateway to start and pass the health check.";
    case "finalize":
      return isZh ? "保存结果并准备 Doctor 验证入口。" : "Saving the results and preparing the Doctor verification entry point.";
    default:
      return isZh ? "等待执行。" : "Waiting to run.";
  }
}

function createFallbackSteps(): InstallSession["steps"] {
  return [
    { id: "inspect", title: "inspect", status: "pending" },
    { id: "runtime", title: "runtime", status: "pending" },
    { id: "openclaw", title: "openclaw", status: "pending" },
    { id: "verify", title: "verify", status: "pending" },
    { id: "finalize", title: "finalize", status: "pending" }
  ];
}

function resolveProgressPercent(
  session: Pick<InstallSession, "status" | "steps"> | Pick<GuidedSetupSession, "status" | "steps"> | null,
  hasInstalledOpenClaw: boolean
): number {
  if (!session) {
    return hasInstalledOpenClaw ? 100 : 10;
  }

  if (session.status === "completed") {
    return 100;
  }

  const completedSteps = session.steps.filter((step) => step.status === "completed").length;
  const runningStep = session.steps.some((step) => step.status === "running") ? 0.5 : 0;
  return Math.min(96, ((completedSteps + runningStep) / session.steps.length) * 100);
}

const ESCAPE_CHAR = String.fromCharCode(27);
const BELL_CHAR = String.fromCharCode(7);
const BACKSPACE_CHAR = String.fromCharCode(8);
const OSC_SEQUENCE_RE = new RegExp(`${ESCAPE_CHAR}\\][^${BELL_CHAR}]*(?:${BELL_CHAR}|${ESCAPE_CHAR}\\\\)`, "g");
const CSI_SEQUENCE_RE = new RegExp(`${ESCAPE_CHAR}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const BACKSPACE_RE = new RegExp(BACKSPACE_CHAR, "g");

function sanitizeTerminalOutput(output: string): string {
  return output
    .replace(OSC_SEQUENCE_RE, "")
    .replace(CSI_SEQUENCE_RE, "")
    .replace(BACKSPACE_RE, "")
    .replace(/\r(?!\n)/g, "\n")
    .trimStart();
}

function formatDisk(bytes: number, language: Language): string {
  const value = bytes / 1024 / 1024 / 1024;
  return `${new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(value)} GB`;
}

function formatDownloadProgress(
  downloadedBytes: number,
  totalBytes: number | undefined,
  language: Language
): string {
  const locale = language === "zh" ? "zh-CN" : "en-US";
  const toMb = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0
    }).format(value / 1024 / 1024);

  if (typeof totalBytes === "number" && totalBytes > 0) {
    return language === "zh"
      ? `已下载 ${toMb(downloadedBytes)} MB / ${toMb(totalBytes)} MB`
      : `${toMb(downloadedBytes)} MB / ${toMb(totalBytes)} MB downloaded`;
  }

  return language === "zh"
    ? `已下载 ${toMb(downloadedBytes)} MB`
    : `${toMb(downloadedBytes)} MB downloaded`;
}

export default App;
