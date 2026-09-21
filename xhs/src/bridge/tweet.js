// 小红书笔记互动与业务代理：100% 驱动原生 DOM 触发官方 React runtime
// 点赞、收藏、评论与关注全走原生事件代理，免逆向、免签名、零风控封号风险

import { findTweetArticle, extractStat, countIn, isLikeActive } from "./x-dom.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 点赞/取消点赞：代理原生卡片或详情中的 .like-wrapper 点击
export async function toggleLike(id, wasLiked = false, article = null) {
  const container = document.getElementById("noteContainer");
  const detailLike = container?.querySelector(".interact-container .like-wrapper, .like-wrapper");
  const art = article || (id ? findTweetArticle(id) : null);
  const cardLike = art?.querySelector(".like-wrapper, .interactions, .like");

  const btn = detailLike || cardLike;
  if (btn) {
    btn.click();
    await sleep(200);
    const isNowLiked = isLikeActive(btn);
    const count = countIn(btn.querySelector(".count")?.textContent || "") || extractStat(btn);
    return { ok: true, liked: isNowLiked !== wasLiked ? isNowLiked : !wasLiked, count };
  }
  return { ok: false };
}

// 收藏/取消收藏：代理原生详情中的 .collect-wrapper 点击
export async function toggleRetweet(_id, wasRetweeted = false, _article = null) {
  const container = document.getElementById("noteContainer");
  const btn = container?.querySelector(".interact-container .collect-wrapper, .collect-wrapper");
  if (btn) {
    btn.click();
    await sleep(200);
    const isNowCollected = !!btn.querySelector(".collect-active, .active") || btn.classList.contains("active");
    const count = countIn(btn.querySelector(".count")?.textContent || "") || extractStat(btn);
    return { ok: true, retweeted: isNowCollected !== wasRetweeted ? isNowCollected : !wasRetweeted, count };
  }
  return { ok: false };
}

export async function toggleBookmark(id, wasBookmarked = false, article = null) {
  return toggleRetweet(id, wasBookmarked, article);
}

// 关注状态与关注切换
export function getProfileFollowState() {
  const btn = document.querySelector(".follow-btn, .note-detail-follow-btn");
  if (!btn) return { visible: false, following: false, btn: null };
  const txt = (btn.innerText || btn.textContent || "").trim();
  const following = txt.includes("已关注") || txt.includes("互相关注");
  return { visible: true, following, btn };
}

export async function toggleFollowOnProfile() {
  const state = getProfileFollowState();
  if (!state.visible || !state.btn) return { ok: false, msg: "未找到关注按钮" };
  state.btn.click();
  await sleep(300);
  const nextState = getProfileFollowState();
  return { ok: true, following: nextState.following };
}

export async function toggleFollowViaCaret(_handle) {
  return toggleFollowOnProfile();
}

export async function toggleTweetFollow(_id, _author) {
  return toggleFollowOnProfile();
}

function nativeCommentRoot() {
  return document.getElementById("noteContainer") || document.querySelector(".note-container");
}

function nativeCommentInput(root) {
  if (!root) return null;
  return root.querySelector(
    '.input-box [contenteditable="true"], .content-edit[contenteditable="true"], .input-box textarea, textarea.comment-input, .comment-input textarea, .input-box p[contenteditable]',
  ) || [...root.querySelectorAll('[contenteditable="true"], textarea')].find((el) =>
    el.closest(".input-box, .comment-input, .engage-bar, .interact-container"));
}

function nativeCommentSend(root, input) {
  const box = input?.closest(".input-box, .comment-input, .comment-wrapper") || root;
  return box?.querySelector("button.submit, .submit, .right-btn-area button, button.send")
    || [...(box?.querySelectorAll("button") || [])].find((b) => /发送|发布/.test(b.textContent || ""));
}

function fillEditable(el, text) {
  el.focus({ preventScroll: true });
  try { document.execCommand("selectAll"); } catch { /* ignore */ }
  if (document.execCommand("insertText", false, text)) return;
  if ("value" in el) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
  } else {
    el.textContent = text;
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

/** 评论：驱动原生详情里的输入框（签名/风控走官方 runtime） */
export async function postCommentViaNative(text) {
  const root = nativeCommentRoot();
  if (!root) return false;
  let input = nativeCommentInput(root);
  if (!input) {
    root.querySelector(".input-box, .comment-input, .engage-bar .chat-wrapper")?.click();
    await sleep(200);
    input = nativeCommentInput(root);
  }
  if (!input) return false;
  const prev = input.style.pointerEvents;
  input.style.pointerEvents = "auto";
  try {
    fillEditable(input, text);
    await sleep(80);
    const send = nativeCommentSend(root, input);
    if (!send) return false;
    send.style.pointerEvents = "auto";
    send.click();
    return true;
  } finally {
    input.style.pointerEvents = prev;
  }
}
