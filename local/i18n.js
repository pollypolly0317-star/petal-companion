import {isShowcase} from './runtime.js';
export const storage = {
  get(key, fallback = null) { try { return JSON.parse(localStorage.getItem('petal:' + key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem('petal:' + key, JSON.stringify(value)); } catch {} }
};
let language = storage.get('locale:v1', 'en') === 'zh-CN' ? 'zh-CN' : 'en';
const en = {};
document.querySelectorAll('[data-i18n]').forEach(el => en[el.dataset.i18n] = el.textContent);
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => en[el.dataset.i18nPlaceholder] = el.placeholder);
document.querySelectorAll('[data-i18n-aria]').forEach(el => en[el.dataset.i18nAria] = el.getAttribute('aria-label'));
Object.assign(en, {
  openLocalApp: "Open the local app",
  showcaseVoice: "Live voice runs in the local app with the audio and chat models. This online showcase includes guided moments, focus and browser-saved notes.",
  inbox: "Your inbox is loud.\nI'm soft.", pat1: "A pat? For me?\nBest meeting all day.", pat2: "Emotional support fluff.\nReporting for duty.", pat3: "You’re doing a lot.\nCome sit with me.",
  okayUser: "I'm doing okay today.", okayReply: "Okay is a lovely place to be. Shall we make a little room for something good?",
  friedUser: "My brain has 37 tabs open.", friedReply: "Let’s close 36. What’s one tiny thing we can do together?",
  overwhelmedUser: "Everything feels like too much.", overwhelmedReply: "Then we don’t have to hold everything at once. I’m here. One breath first?",
  lowUser: "I'm running on 1%.", lowReply: "Low battery is not a personality flaw. Let’s find a little recharge. No heroic productivity required.",
  jokeUser: "Petal, make me smile.", joke0: "I added “overthinking” to my to-do list. Finally, something I can cross off.",
  joke1: "You have 37 tabs open. I have no hands. Together, we are a very interesting team.",
  joke2: "My five-year plan? Get fluffier. Your next five minutes can be just as ambitious.",
  focusUser: "Will you focus with me?", focusReply: "Absolutely. Pick one small thing. I’ll be your very fluffy accountability department.",
  pauseFocus: "Take a little pause", resumeFocus: "Let’s ease back in", againFocus: "Another little moment",
  focusRunning: "One thing at a time. I’m right here.", focusPaused: "Paused. You’re allowed to be a person.", focusDone: "You showed up. That counts. Time for a little stretch?",
  breathReady: "Ready when you are", breathMinute: "One minute, just for you", inhale: "Breathe in", exhale: "Breathe out", breathDone: "A little softer.", breathComplete: "You made a little space for yourself.", stopBreath: "Finish for now", breathSeconds: "{n}s left",
  quietOn: "Quiet company. Just us, a little stiller.", quietOff: "A little less alone. A little more you.",
  saved: "Saved", unsaved: "Unsaved", saving: "Keeping it safe…", draftKept: "Draft preserved · save needs attention",
  words: "{n} words", noteMissing: "That note isn’t here yet.", noMatches: "No notes match this search.", noNotes: "A little space for your first thought.",
  discard: "Leave this unsaved draft? Your latest edits haven’t been saved.", conflict: "This note changed elsewhere. Your draft is still here; copy it before reloading to merge.",
  savedPath: "Kept safe · {path}", notesError: "Couldn’t load your notes. Please try again.", noteInvalid: "Use a name without .. or special path characters.", noteExists: "This note already exists. Choose a different name.",
  modelsAudioOnly: "Audio-only voice is ready. Conversation + notes is still getting ready.",
  modelsChecking: "Checking local models…", modelsOffline: "Local models are still getting ready. Try the guided moments while they load.",
  modelsReady: "Local chat is ready. Your conversation stays on this computer.", modelsChatOnly: "Text chat is ready. Voice is still getting ready.",
  chatError: "That reply didn’t make it through. Your message is kept above; please try again.", thinking: "Petal is thinking…", listening: "Listening", speaking: "Speaking", waiting: "Waiting", ready: "Ready",
  talk: "Start voice conversation", endTalk: "End voice conversation", interrupt: "Interrupt response", spoken: "[Spoken audio]",
  streamError: "The voice connection ended early. Please try again.", localError: "Couldn’t reach the local model.",
  micError: "Microphone unavailable. You can type a message instead.", send: "Send message"
});
const zh = {
  openLocalApp:"打开本地应用",showcaseVoice:"实时语音需要在本地应用中运行语音与对话模型。线上展示提供陪伴预览、专注计时和浏览器便签。",skip:"跳转至正文",meet:"认识 Petal",tryMoment:"陪伴一刻",littleNotes:"小小便签",watchDemo:"观看演示",
  headline1:"情绪很大。",headline2:"搭子软软的。",lead1:"一点专注，一点笑意。",lead2:"忙碌之间，也有一个柔软的落脚点。",
  spendMinute:"和她待一会儿",seeAction:"看看怎么互动",conceptNote:"未来的桌面陪伴搭子。先在这里认识她。",petAria:"轻轻摸摸 Petal",givePat:"轻轻摸摸她",
  batteryHeading:"你的「人类电量」还好吗？",moodOkay:"还不错",moodFried:"脑子有点糊",moodOverwhelmed:"有点撑不住",moodLow:"只剩 1% 电量",
  previewLabel:"互动预览 · 示例回应",you:"你",focusMe:"陪我专注",softReset:"松一口气",makeSmile:"逗我笑一下",focusTogether:"一起专注",oneThing:"只做一件小事…",
  startFocus:"慢慢来，我们开始",resetTimer:"重置专注计时",calmerYou:"放松一点的你，也很值得。",
  notesTitle:"给脑袋腾一点地方。",notesSubtitle:"灵感、碎碎念，和改天再说的事。先放在这里。",newNote:"写一张小便签",searchNotes:"找一找小便签",allNotes:"全部便签",
  emptyTitle:"让思绪也歇歇脚。",emptyBody:"不用字字完美。这是一个可以暂时放下的地方。",firstNote:"写第一张小便签",notePath:"便签路径",noteEditor:"便签编辑器",saveNote:"替我收好",
  editorPlaceholder:"不必写得漂亮，写下你想说的就好。",localNotes:"保存在这台电脑上。",footerLine:"少一点孤单，多一点自己。",meetFamily:"认识毛茸茸家族",localChat:"本地对话",quietMode:"安静陪伴模式",
  prototypeLabel:"网页原型 · 实体陪伴产品概念",close:"关闭",breathTitle:"让世界等你一分钟。",breathIntro:"跟随自己舒服的节奏，不需要做得完美。",breathHint:"这一分钟，不必用来提高效率。",startBreath:"和 Petal 一起呼吸",
  noteNameTitle:"给这个念头起个名字？",noteNameLabel:"名字，或 文件夹 / 名字",startWriting:"开始写",
  videoTitle:"和她待一小会儿。",videoSubtitle:"网页原型的操作演示。示例互动，真实可体验的小习惯。",videoNote:"产品概念 · 英文字幕",downloadDemo:"下载演示",
  familyTitle:"不同性格，一起发光。",familySubtitle:"探索更多毛茸茸的可能。这些是实体产品的概念形象。",chatTitle:"留一点空间，聊聊天。",chatIntro:"实时对话需要本地模型。陪伴预览随时都可以体验。",
  chatPlaceholder:"你在想些什么？",voiceSettings:"语音设置与详情",voiceMode:"语音模式",voiceNotes:"语音与便签 · 较慢",voiceOnly:"快速语音 · 英语",send:"发送消息",
  inbox:"收件箱吵吵的。\n我软软的。",pat1:"摸摸是给我的？\n今天最棒的会议！",pat2:"情绪支援毛球，\n到岗啦。",pat3:"你已经做了很多。\n来，坐我旁边。",
  okayUser:"今天感觉还不错。",okayReply:"还不错，就是个很好的地方。一起给小小的快乐留点空位？",
  friedUser:"脑子里开了 37 个标签页。",friedReply:"那我们先关掉 36 个。一起做一件小小的事，好吗？",
  overwhelmedUser:"感觉什么都压过来了。",overwhelmedReply:"那我们先不扛下所有事情。我在呢。先一起呼吸一下？",
  lowUser:"我的电量只剩 1% 了。",lowReply:"低电量不是你的性格缺陷。先充点电，今天不用当效率超人。",
  jokeUser:"Petal，逗我笑一下。",joke0:"我把「想太多」写进了待办清单。终于有一项可以打勾了。",
  joke1:"你开了 37 个标签页，我没有手。咱俩的团队配置，属实有点特别。",joke2:"我的五年计划：变得更毛茸茸。你的下一个五分钟，也可以这么有抱负。",
  focusUser:"你会陪我专注吗？",focusReply:"当然。选一件小事吧。你的毛茸茸陪伴部门，正式开工。",
  pauseFocus:"先歇一小会儿",resumeFocus:"慢慢回来",againFocus:"再来一个小片刻",focusRunning:"一次一件事。我就在这里。",focusPaused:"暂停啦。你当然可以休息。",focusDone:"你来过、努力过，就值得肯定。伸个懒腰吧？",
  breathReady:"准备好了再开始",breathMinute:"这一分钟，只属于你",inhale:"慢慢吸气",exhale:"轻轻呼气",breathDone:"松一点点了。",breathComplete:"你给自己留了一点空间。",stopBreath:"先到这里",breathSeconds:"还有 {n} 秒",
  quietOn:"安安静静陪着你。",quietOff:"少一点孤单，多一点自己。",saved:"已收好",unsaved:"还没保存",saving:"正在收好…",draftKept:"草稿还在 · 保存需要处理",
  words:"{n} 字",noteMissing:"这张便签还不在这里。",noMatches:"没有找到匹配的便签。",noNotes:"这里等着你的第一个念头。",discard:"离开未保存的草稿吗？最新修改还没有保存。",conflict:"便签在其他地方更新了。草稿已保留，请先复制，再刷新合并。",
  savedPath:"收好啦 · {path}",notesError:"便签暂时没能加载，请再试一次。",noteInvalid:"请使用不包含 .. 或特殊路径字符的名字。",noteExists:"这张便签已经存在，请换个名字。",
  modelsAudioOnly:"仅语音模式已就绪，对话与便签模型仍在准备。",modelsChecking:"正在检查本地模型…",modelsOffline:"本地模型还在准备。现在可以先体验陪伴预览。",modelsReady:"本地对话已就绪。对话留在这台电脑上。",modelsChatOnly:"文字对话已就绪，语音仍在准备。",
  chatError:"刚才没能收到回复。你的消息已保留在上方，可以再试一次。",thinking:"Petal 正在想…",listening:"正在听你说",speaking:"正在回应",waiting:"等待中",ready:"准备好了",
  talk:"开始语音对话",endTalk:"结束语音对话",interrupt:"打断回应",spoken:"[语音消息]",streamError:"语音连接提前结束，请重试。",localError:"暂时无法连接本地模型。",micError:"麦克风暂不可用，可以先打字聊天。"
};
if(isShowcase){
  en.localNotes="Saved in this browser. Clearing browser data removes these notes.";
  zh.localNotes="保存在当前浏览器。清除浏览器数据将删除便签。";
  en.localChat="Voice availability";zh.localChat="语音使用说明";
  en.chatIntro="Try the guided moments here, or open the local app for live conversation.";
  zh.chatIntro="在这里体验陪伴预览，或打开本地应用使用实时对话。";
}
export const getLanguage = () => language;
export function t(key, params = {}) {
  let value = (language === 'zh-CN' ? zh[key] : en[key]) ?? en[key] ?? key;
  for (const [k,v] of Object.entries(params)) value = value.replaceAll('{' + k + '}', v);
  return value;
}
export function applyLanguage(next = language) {
  language = next === 'zh-CN' ? 'zh-CN' : 'en';
  storage.set('locale:v1', language);
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'Petal — Small, fluffy friend.' : 'Petal — 毛茸茸的陪伴搭子';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.getElementById('locale-toggle').setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : 'Switch to English');
  window.dispatchEvent(new Event('petal-language'));
}
applyLanguage();
