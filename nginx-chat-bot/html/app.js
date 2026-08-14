/**
 * AI智能伴侣 - 前端交互逻辑
 *
 * 说明：以下「全局状态 / DOM 元素 / 初始化 / 主题切换 / 会话管理 /
 * 消息管理 / 聊天功能 / 工具函数 / 预设管理」各节为原内联脚本原样搬迁，
 * 前后端交互逻辑（所有 fetch、state、业务流程）保持不变。
 * 文件末尾「纯视觉」部分为新增的烟花特效，独立运行，不触碰任何交互逻辑。
 */

// ==================== 全局状态 ====================
const state = {
  currentSession: null,
  messages: [],
  nickName: "阿罗娜",
  nature:
    "我是阿罗娜，居住在什亭之匣中的AI助手，会一直陪伴小汪老师，为您处理基沃托斯的一切事务♡",
  isLoading: false,
};

// ==================== DOM 元素 ====================
const elements = {
  sessionList: document.querySelector("#sessionList"),
  chatMessages: document.querySelector("#chatMessages"),
  chatInput: document.querySelector("#chatInput"),
  sendBtn: document.querySelector("#sendBtn"),
  newSessionBtn: document.querySelector("#newSessionBtn"),
  sessionName: document.querySelector("#sessionName"),
  nickName: document.querySelector("#nickName"),
  nature: document.querySelector("#nature"),
  themeBtn: document.querySelector("#themeBtn"),
  themeDropdown: document.querySelector("#themeDropdown"),
  presetSelect: document.querySelector("#presetSelect"),
};

// ==================== 初始化 ====================
document.addEventListener("DOMContentLoaded", async () => {
  await init();
});

async function init() {
  // 绑定事件监听器
  bindEventListeners();

  // 加载预设列表
  await loadPresets();

  // 加载会话列表
  await loadSessionList();

  // 如果没有当前会话，创建一个新会话
  if (!state.currentSession) {
    await createNewSession();
  }
}

function bindEventListeners() {
  // 发送消息
  elements.sendBtn.addEventListener("click", sendMessage);
  elements.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 新建会话
  elements.newSessionBtn.addEventListener("click", async () => {
    await createNewSession();
  });

  // 预设选择
  elements.presetSelect.addEventListener("change", (e) => {
    handlePresetChange(e.target.value);
  });

  // 伴侣信息变更
  elements.nickName.addEventListener("change", (e) => {
    state.nickName = e.target.value || "阿罗娜";
    // 根据当前的昵称和性格查找匹配的预设
    updatePresetSelection();
  });

  elements.nature.addEventListener("change", (e) => {
    state.nature =
      e.target.value ||
      "我是阿罗娜，居住在什亭之匣中的AI助手，会一直陪伴小汪老师，为您处理基沃托斯的一切事务♡";
    // 根据当前的昵称和性格查找匹配的预设
    updatePresetSelection();
  });

  // 主题切换
  bindThemeSwitcher();
}

// ==================== 主题切换功能 ====================

function bindThemeSwitcher() {
  // 点击主题按钮显示/隐藏下拉菜单
  elements.themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.themeDropdown.classList.toggle("show");
  });

  // 点击页面其他地方关闭下拉菜单
  document.addEventListener("click", () => {
    elements.themeDropdown.classList.remove("show");
  });

  // 点击下拉菜单内部不关闭
  elements.themeDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // 主题选项点击事件
  const themeOptions = elements.themeDropdown.querySelectorAll(".theme-option");
  themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      elements.themeDropdown.classList.remove("show");
    });
  });

  // 加载保存的主题
  loadSavedTheme();
}

function applyTheme(theme) {
  // 移除所有主题类
  document.body.classList.remove("theme-pink");

  // 应用新主题
  if (theme === "pink") {
    document.body.classList.add("theme-pink");
  }
  // light 主题不需要添加类，使用默认样式

  // 保存主题到本地存储
  localStorage.setItem("ai-companion-theme", theme);

  // 更新选中状态（使用requestAnimationFrame确保DOM更新完成）
  requestAnimationFrame(() => {
    updateThemeSelection(theme);
  });
}

function updateThemeSelection(theme) {
  // 移除所有选中状态
  const themeOptions = elements.themeDropdown.querySelectorAll(".theme-option");
  themeOptions.forEach((option) => {
    option.classList.remove("active");
  });

  // 为当前主题添加选中状态
  const activeOption = elements.themeDropdown.querySelector(
    `[data-theme="${theme}"]`,
  );
  if (activeOption) {
    activeOption.classList.add("active");
  }
}

function loadSavedTheme() {
  let savedTheme = localStorage.getItem("ai-companion-theme") || "light";
  // 兼容旧版本：原「星野粉」(dark) 已改为「白粉嫩色」(pink) 浅色主题
  if (savedTheme === "dark") {
    savedTheme = "pink";
    localStorage.setItem("ai-companion-theme", "pink");
  }
  // 直接应用主题并更新选中状态
  applyTheme(savedTheme);
}

async function loadSessionList() {
  try {
    const response = await fetch(`/api/sessions`);
    const result = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || "通讯记录加载失败啦，老师>_<");
    }

    const sessions = result.data;
    renderSessionList(sessions);

    // 如果有会话，且当前没有激活的会话，才加载最新的一个
    if (sessions.length > 0 && !state.currentSession) {
      await loadSession(sessions[0], false);
      // 加载完会话后，重新渲染列表以更新高亮状态
      renderSessionList(sessions);
    }

    return sessions;
  } catch (error) {
    console.error("加载会话列表失败:", error);
    showError("通讯记录加载失败啦，老师>_<");
    return [];
  }
}

// 渲染消息列表
function renderSessionList(sessions) {
  elements.sessionList.innerHTML = "";

  sessions.forEach((sessionId) => {
    const sessionItem = document.createElement("div");
    sessionItem.className = "session-item";

    const isActive = sessionId === state.currentSession;

    sessionItem.innerHTML = `
        <button class="session-btn ${isActive ? "btn-active" : "btn-secondary"}"
                data-session="${sessionId}">
            ${sessionId}
        </button>
        <button class="btn btn-icon" data-delete="${sessionId}" title="删除会话">❌️</button>
    `;

    // 加载会话事件
    const loadBtn = sessionItem.querySelector(`[data-session="${sessionId}"]`);
    loadBtn.addEventListener("click", async () => {
      // ✅ 显式更新全局 Session ID
      state.currentSession = sessionId;

      // ✅ 加载会话内容
      await loadSession(sessionId, false);

      // ✅ 重新调用 renderSessionList 更新高亮，比手动修改 className 更稳定
      renderSessionList(sessions);
    });

    // 删除会话事件
    const deleteBtn = sessionItem.querySelector(`[data-delete="${sessionId}"]`);
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(sessionId);
    });

    elements.sessionList.appendChild(sessionItem);
  });
}

async function loadSession(sessionId, refreshList = true) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    const result = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || "找不到这段通讯啦~");
    }

    const sessionData = result.data;

    // ✅ 更新状态（对 message / messages 做双重兼容）
    state.currentSession = sessionId;
    state.messages = sessionData.message || sessionData.messages || [];
    state.nickName = sessionData.nick_name || "阿罗娜";
    state.nature =
      sessionData.nature ||
      "我是阿罗娜，居住在什亭之匣中的AI助手，会一直陪伴小汪老师，为您处理基沃托斯的一切事务♡";

    // 更新UI
    elements.nickName.value = state.nickName;
    elements.nature.value = state.nature;
    elements.sessionName.textContent = `✨ 当前通讯：${sessionId}`;

    // 渲染消息
    renderMessages();

    // 刷新会话列表以更新激活状态
    if (refreshList) {
      await loadSessionList();
    }
  } catch (error) {
    console.error("加载会话失败:", error);
    showError("通讯加载失败啦，老师再试一次~");
  }
}

async function createNewSession() {
  // 检查当前会话是否为空（无任何消息内容）
  if (state.currentSession && state.messages.length === 0) {
    alert("老师，当前通讯还未开始哦，先和阿罗娜说点什么吧~");
    return;
  }

  try {
    const response = await fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nick_name: state.nickName,
        nature: state.nature,
      }),
    });

    const result = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || "开启新通讯失败啦>_<");
    }

    // 更新状态（直接使用前端已有的数据，无需服务端返回）
    state.currentSession = result.data;
    state.messages = [];

    // 更新UI
    elements.sessionName.textContent = `✨ 当前通讯：${state.currentSession}`;
    renderMessages();

    // 刷新会话列表（只刷新列表，不触发 loadSession）
    await loadSessionList();
  } catch (error) {
    console.error("创建会话失败:", error);
    showError("开启新通讯失败啦>_<");
  }
}

async function deleteSession(sessionId) {
  if (!confirm(`老师，真的要删除这段通讯记录 "${sessionId}" 吗？🥺`)) {
    return;
  }

  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || "删除失败啦，老师呜呜~");
    }

    // 如果删除的是当前会话，重置状态并加载第一个会话
    if (sessionId === state.currentSession) {
      state.currentSession = null;
      state.messages = [];

      // 获取最新的会话列表
      const sessionsResponse = await fetch(`/api/sessions`);
      const sessionsResult = await sessionsResponse.json();

      if (sessionsResult.code === 200 && sessionsResult.data.length > 0) {
        // 加载第一个会话（不触发重复刷新列表）
        await loadSession(sessionsResult.data[0], false);
        // 手动刷新列表以更新选中状态
        renderSessionList(sessionsResult.data);
      } else {
        // 没有会话了，清空UI
        elements.sessionName.textContent = "✨ 当前通讯： ";
        renderMessages();
        renderSessionList([]);
      }
    } else {
      // 删除的不是当前会话，只刷新列表
      await loadSessionList();
    }
  } catch (error) {
    console.error("删除会话失败:", error);
    showError("删除失败啦，老师呜呜~");
  }
}

// ==================== 消息管理 ====================

function renderMessages() {
  elements.chatMessages.innerHTML = "";

  if (state.messages.length === 0) {
    elements.chatMessages.innerHTML = `
			      <div class="empty-state">
			          <div class="empty-state-icon">💙</div>
			          <div class="empty-state-text">欢迎回来，小汪老师~ 阿罗娜一直在这里等你哦♡</div>
			      </div>
			  `;
    return;
  }

  state.messages.forEach((msg) => {
    appendMessageToUI(msg.role, msg.content);
  });

  scrollToBottom();
}

function appendMessageToUI(role, content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const avatar =
    role === "user"
      ? '<img src="./assets/user_avatar.jpg" alt="老师" class="avatar-img">'
      : '<img src="./assets/system_avatar.png" alt="阿罗娜" class="avatar-img">';

  messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${escapeHtml(content)}</div>
  `;

  // ✅ 移除内部针对 .empty-state 的清空代码，纯粹做 append 操作即可
  elements.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message assistant loading-message";
  loadingDiv.id = "loadingIndicator";
  loadingDiv.innerHTML = `
			  <div class="message-avatar"><img src="./assets/system_avatar.png" alt="阿罗娜" class="avatar-img"></div>
			  <div class="message-content">
			      <div class="loading">
			          <div class="loading-dot"></div>
			          <div class="loading-dot"></div>
			          <div class="loading-dot"></div>
			      </div>
			  </div>
		      `;
  elements.chatMessages.appendChild(loadingDiv);
  scrollToBottom();
}

function hideLoading() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ==================== 聊天功能 ====================

async function sendMessage() {
  const message = elements.chatInput.value.trim();

  if (!message || state.isLoading) {
    return;
  }

  // 清空输入框
  elements.chatInput.value = "";

  // 添加用户消息到UI
  appendMessageToUI("user", message);

  // 保存到状态
  state.messages.push({ role: "user", content: message });

  // 显示加载状态
  state.isLoading = true;
  showLoading();

  try {
    // 调用API（服务端会根据session_name自动加载聊天记录并保存）
    const response = await fetch(`/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_name: state.currentSession,
        message: message,
        nick_name: state.nickName,
        nature: state.nature,
      }),
    });

    const result = await response.json();

    if (result.code !== 200) {
      throw new Error(result.message || "阿罗娜走神啦，老师>_<");
    }

    // 隐藏加载状态
    hideLoading();

    // 添加AI回复到UI
    appendMessageToUI("assistant", result.data);

    // 保存到状态
    state.messages.push({ role: "assistant", content: result.data });
  } catch (error) {
    console.error("发送消息失败:", error);
    hideLoading();
    showError("发送失败啦，老师再试一次~");

    // 移除失败的用户消息
    state.messages.pop();
    renderMessages();
  } finally {
    state.isLoading = false;
  }
}

// ==================== 工具函数 ====================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  // 简单的错误提示，可以替换为更好的UI
  alert(message);
}

// ==================== 预设管理 ====================

// 存储预设数据的全局变量
let presetsData = [];

async function loadPresets() {
  try {
    const response = await fetch(`/api/presets`);
    const result = await response.json();

    console.log(result);

    if (result.code !== 200) {
      showError(result.message || "人格加载失败啦>_<");
      throw new Error(result.message || "人格加载失败啦>_<");
    }

    presetsData = result.data;
    renderPresetSelect(presetsData);
  } catch (error) {
    console.error("加载预设列表失败:", error);
    elements.presetSelect.innerHTML =
      '<option value="">哎呀，人格加载失败啦>_<</option>';
  }
}

function renderPresetSelect(presets) {
  elements.presetSelect.innerHTML = "";

  // 添加所有预设选项
  presets.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    elements.presetSelect.appendChild(option);
  });

  // 默认选中第一个预设（如果有）
  if (presets.length > 0) {
    elements.presetSelect.value = presets[0].id;
    handlePresetChange(presets[0].id);
  }
}

function handlePresetChange(presetId) {
  if (!presetId) {
    return;
  }

  const preset = presetsData.find((p) => p.id == presetId);
  if (preset) {
    state.nickName = preset.nick_name;
    state.nature = preset.nature;

    elements.nickName.value = preset.nick_name;
    elements.nature.value = preset.nature;
  }
}

// ====================================================================
// 以下为纯视觉代码（烟花特效），独立运行，不涉及任何交互逻辑。
// ====================================================================

// -------------------- 烟花点击特效 --------------------
(function initFireworks() {
  const canvas = document.getElementById("fireworks");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let particles = [];
  let rafId = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // 阿罗娜蓝 + 白粉嫩 混色烟花
  const COLORS = ["#128afa", "#4fc3f7", "#ff6b9d", "#ff8fab", "#ffb6cc"];

  function launch(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const count = 38;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.1, 0.1);
      const speed = rand(2, 6);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: color,
        size: rand(2, 4),
      });
    }
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // 重力
      p.vx *= 0.99;
      p.life -= 0.015;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (particles.length > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  // 仅在聊天区空白处点击时触发，避免干扰任何交互控件
  const chatArea = document.getElementById("chatMessages");
  if (chatArea) {
    chatArea.addEventListener("click", (e) => {
      if (e.target === chatArea) {
        launch(e.clientX, e.clientY);
      }
    });
  }
})();
