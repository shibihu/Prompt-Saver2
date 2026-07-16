const STORAGE_KEY = 'prompt-saver-prompts';
const AUTH_STORAGE_KEY = 'prompt-saver-auth';
const form = document.getElementById('prompt-form');
const titleInput = document.getElementById('prompt-title');
const categoryInput = document.getElementById('prompt-category');
const categorySelect = document.getElementById('category-select');
const textInput = document.getElementById('prompt-text');
const list = document.getElementById('prompt-list');
const emptyMessage = document.getElementById('empty-message');
const searchInput = document.getElementById('search-input');
const cancelEditButton = document.getElementById('cancel-edit');
const saveButton = document.getElementById('save-btn');
const copyStatus = document.getElementById('copy-status');
const categoryList = document.getElementById('category-list');
const clearCategoryFilterButton = document.getElementById('clear-category-filter');
const totalCount = document.getElementById('total-count');
const activeCount = document.getElementById('active-count');
const categoryCount = document.getElementById('category-count');
const listTitle = document.getElementById('list-title');
const listSummary = document.getElementById('list-summary');
const googleButton = document.getElementById('google-button');
const googleClientIdInput = document.getElementById('google-client-id');
const authStatus = document.getElementById('auth-status');
const signOutButton = document.getElementById('sign-out-btn');
const userCard = document.getElementById('user-card');

// ฟีเจอร์ใหม่: ตัวเลือกฝั่ง HTML (ปุ่มควบคุมภายนอก)
const exportButton = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const optimizeButton = document.getElementById('optimize-btn');

let prompts = [];
let editingId = null;
let activeCategory = 'all';
let currentUser = null;

function loadAuthState() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Unable to load auth state:', error);
    return null;
  }
}

function saveAuthState() {
  if (!currentUser) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
}

function getPromptStorageKey() {
  return currentUser ? `${STORAGE_KEY}-${currentUser.id}` : `${STORAGE_KEY}-guest`;
}

// อัปเดตข้อมูลรองรับฟิลด์ isPinned และ useCount
function loadPrompts() {
  try {
    const raw = localStorage.getItem(getPromptStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((prompt) => ({
          ...prompt,
          title: prompt.title || '',
          text: prompt.text || '',
          category: prompt.category ? prompt.category.trim() : 'Uncategorized',
          createdAt: prompt.createdAt || new Date().toISOString(),
          isPinned: prompt.isPinned || false, // กำหนดค่าเริ่มต้นถ้าไม่มีข้อมูลเก่า
          useCount: prompt.useCount || 0,     // กำหนดค่าเริ่มต้นสถิติการใช้งาน
        }))
      : [];
  } catch (error) {
    console.error('Unable to load prompts:', error);
    return [];
  }
}

function savePrompts() {
  localStorage.setItem(getPromptStorageKey(), JSON.stringify(prompts));
}

function normalizeCategory(value) {
  const category = (value || '').trim();
  return category || 'Uncategorized';
}

function getCategoryName(prompt) {
  return normalizeCategory(prompt.category);
}

function resetForm() {
  form.reset();
  categorySelect.value = '';
  editingId = null;
  updateFormMode();
}

function updateFormMode() {
  if (editingId) {
    saveButton.textContent = 'Update Prompt';
    cancelEditButton.classList.remove('hidden');
  } else {
    saveButton.textContent = 'Save Prompt';
    cancelEditButton.classList.add('hidden');
  }
}

function setFormEnabled(enabled) {
  const controls = [titleInput, categoryInput, categorySelect, textInput, saveButton, cancelEditButton, optimizeButton];
  controls.forEach((control) => {
    if (control) control.disabled = !enabled;
  });
}

function showStatus(message) {
  copyStatus.textContent = message;
  clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    copyStatus.textContent = '';
  }, 1800);
}

function populateCategorySelect() {
  const categories = getCategories();
  const currentCategory = categoryInput.value.trim() || categorySelect.value || '';
  categorySelect.innerHTML = '<option value="">Choose existing category</option>';

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  if (currentCategory && categories.includes(currentCategory)) {
    categorySelect.value = currentCategory;
  } else if (currentCategory) {
    categoryInput.value = currentCategory;
  }
}

function getCategories() {
  return [...new Set(prompts.map(getCategoryName).sort((a, b) => a.localeCompare(b)))];
}

function renderSidebar() {
  const categories = getCategories();
  categoryList.innerHTML = '';

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = `category-pill ${activeCategory === 'all' ? 'active' : ''}`;
  allButton.innerHTML = '<span>All prompts</span><strong>' + prompts.length + '</strong>';
  allButton.addEventListener('click', () => {
    activeCategory = 'all';
    render();
  });
  categoryList.appendChild(allButton);

  categories.forEach((category) => {
    const count = prompts.filter((prompt) => getCategoryName(prompt) === category).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-pill ${activeCategory === category ? 'active' : ''}`;
    button.innerHTML = '<span>' + category + '</span><strong>' + count + '</strong>';
    button.addEventListener('click', () => {
      activeCategory = category;
      render();
    });
    categoryList.appendChild(button);
  });

  totalCount.textContent = prompts.length;
  const visibleCount = getFilteredPrompts().length;
  activeCount.textContent = visibleCount;
  categoryCount.textContent = categories.length;
}

function getFilteredPrompts() {
  const query = searchInput.value.trim().toLowerCase();
  return prompts.filter((prompt) => {
    const categoryName = getCategoryName(prompt);
    const haystack = `${prompt.title} ${prompt.text} ${categoryName}`.toLowerCase();
    const matchesQuery = haystack.includes(query);
    const matchesCategory = activeCategory === 'all' || categoryName === activeCategory;
    return matchesQuery && matchesCategory;
  });
}

// อัปเดตการจัดเรียงและการแสดงสถิติ/ปุ่มปักหมุด
function renderPrompts() {
  // แก้ไข: เรียงลำดับโดยเอาอันที่ปักหมุด (isPinned) ขึ้นก่อน จากนั้นค่อยเรียงตามเวลาล่าสุด
  const filteredPrompts = getFilteredPrompts().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  list.innerHTML = '';

  if (filteredPrompts.length === 0) {
    emptyMessage.classList.remove('hidden');
    listTitle.textContent = activeCategory === 'all' ? 'All prompts' : `${activeCategory} prompts`;
    listSummary.textContent = '0 prompts';
    return;
  }

  emptyMessage.classList.add('hidden');
  listTitle.textContent = activeCategory === 'all' ? 'All prompts' : `${activeCategory} prompts`;
  listSummary.textContent = `${filteredPrompts.length} ${filteredPrompts.length === 1 ? 'prompt' : 'prompts'}`;

  filteredPrompts.forEach((prompt) => {
    const item = document.createElement('li');
    // เพิ่มคลาสสำหรับสไตล์การปักหมุด
    item.className = `prompt-card ${prompt.isPinned ? 'pinned-card' : ''}`;
    item.dataset.id = prompt.id;

    const header = document.createElement('header');
    const titleRow = document.createElement('div');
    titleRow.className = 'prompt-title-row';

    const title = document.createElement('h3');
    title.className = 'prompt-title';
    // เติมไอคอน 📌 หน้าชื่อถ้ามีการปักหมุด
    title.textContent = (prompt.isPinned ? '📌 ' : '') + (prompt.title || 'Untitled Prompt');

    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.textContent = getCategoryName(prompt);

    titleRow.append(title, badge);
    header.appendChild(titleRow);

    const meta = document.createElement('span');
    meta.className = 'prompt-meta';
    // แสดงข้อมูลเวลาควบคู่สถิติการกดคัดลอก (useCount)
    meta.textContent = `${new Date(prompt.createdAt).toLocaleString()} | 📊 โดนก๊อปไปแล้ว: ${prompt.useCount || 0} ครั้ง`;
    header.appendChild(meta);

    const text = document.createElement('p');
    text.className = 'prompt-text';
    text.textContent = prompt.text;

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';

    // ฟีเจอร์ใหม่: ปุ่มปักหมุด
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'pin-btn';
    pinButton.textContent = prompt.isPinned ? 'Unpin' : 'Pin';
    pinButton.addEventListener('click', () => togglePinPrompt(prompt.id));

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'copy-btn';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => copyPrompt(prompt));

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => startEditing(prompt.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deletePrompt(prompt.id));

    // ใส่ปุ่ม Pin นำหน้าปุ่มอื่นๆ
    actions.append(pinButton, copyButton, editButton, deleteButton);
    item.append(header, text, actions);
    list.appendChild(item);
  });
}

function renderAuthState() {
  setFormEnabled(true); 
  
  if (currentUser) {
    signOutButton.classList.remove('hidden');
    userCard.classList.remove('hidden');
    userCard.innerHTML = `
      <img class="user-avatar" src="${currentUser.picture || 'https://www.gravatar.com/avatar?d=mp'}" alt="${currentUser.name || 'User'}" />
      <div class="user-info">
        <span class="user-name">${currentUser.name || 'Signed in'}</span>
        <span class="user-email">${currentUser.email || 'Google account'}</span>
      </div>
    `;
    authStatus.textContent = 'Signed in with Google. Your prompts stay linked to this account.';
  } else {
    signOutButton.classList.add('hidden');
    userCard.classList.add('hidden');
    authStatus.textContent = 'Using Guest Mode (Saved locally). Sign in with Google to sync across devices.';
  }
}

function render() {
  populateCategorySelect();
  renderSidebar();
  renderPrompts();
  renderAuthState();
}

function startEditing(id) {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return;

  editingId = id;
  titleInput.value = prompt.title;
  categoryInput.value = getCategoryName(prompt);
  categorySelect.value = getCategoryName(prompt);
  textInput.value = prompt.text;
  updateFormMode();
  titleInput.focus();
}

// ฟีเจอร์ใหม่: ฟังก์ชันทำงานเมื่อสลับสถานะการปักหมุด
function togglePinPrompt(id) {
  prompts = prompts.map((prompt) => 
    prompt.id === id ? { ...prompt, isPinned: !prompt.isPinned } : prompt
  );
  savePrompts();
  render();
}

// อัปเดตฟังก์ชันเพื่อบันทึกสถิติการนับจำนวนครั้งที่ Copy
async function copyPrompt(prompt) {
  try {
    await navigator.clipboard.writeText(prompt.text);
    showStatus('Prompt copied');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = prompt.text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showStatus('Prompt copied');
  }

  // อัปเดตยอดคลิกคัดลอก (Analytics)
  prompts = prompts.map((p) => 
    p.id === prompt.id ? { ...p, useCount: (p.useCount || 0) + 1 } : p
  );
  savePrompts();
  render();
}

// ฟีเจอร์ใหม่: ฟังก์ชันช่วยขยายโครงสร้างคำสั่งผ่าน AI Optimizer
async function optimizePromptWithAI() {
  const originalText = textInput.value.trim();
  if (!originalText) {
    alert('กรุณาพิมพ์ข้อความลงในช่อง Prompt ก่อนเพิ่มระดับความละเอียดครับ!');
    return;
  }

  optimizeButton.disabled = true;
  optimizeButton.textContent = '🪄 กำลังเกลาคำสั่ง...';

  try {
    // 💡 คำแนะนำ: สำหรับการใช้งานจริง ให้ใส่ Google Gemini API Key ของคุณที่นี่
    const API_KEY = 'YOUR_GEMINI_API_KEY';

    if (API_KEY === 'YOUR_GEMINI_API_KEY') {
      // โหมดจำลองจำลองระบบ (Mock Upgrade) ในกรณีที่ยังไม่ได้ต่อคีย์แท้
      setTimeout(() => {
        textInput.value = `[Optimized ✨] Act as an Expert.\n\n[Context]\n${originalText}\n\n[Objective]\nProvide a comprehensive, high-quality output based on the details above. Avoid superficial answers and structure it clearly.`;
        optimizeButton.disabled = false;
        optimizeButton.textContent = '✨ Optimize Prompt';
        showStatus('จำลองการปรับแต่ง Prompt สำเร็จ!');
      }, 1000);
      return;
    }

    // ยิง API ไปหาโครงข่ายของ Gemini โดยตรงเพื่อเกลาภาษาข้อความ
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert Prompt Engineer. Optimize the following draft prompt to make it clear, well-structured, and highly effective for an LLM. Keep the original intent intact but add structured sections like Role, Context, and Constraints if applicable. Only return the optimized prompt text without any introductory remarks or markdown code blocks:\n\n${originalText}`
          }]
        }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      textInput.value = data.candidates[0].content.parts[0].text.trim();
      showStatus('เกลาคำสั่งเสร็จเรียบร้อย!');
    } else {
      throw new Error('Invalid API Response');
    }
  } catch (error) {
    console.error('AI Optimization failed:', error);
    alert('ระบบเกลาล้มเหลว ตรวจสอบความถูกต้องของ API Key ในโค้ดสคริปต์');
  } finally {
    optimizeButton.disabled = false;
    optimizeButton.textContent = '✨ Optimize Prompt';
  }
}

// ฟีเจอร์ใหม่: ส่งออกข้อมูลออกเป็นไฟล์ดาวน์โหลด JSON
function exportPrompts() {
  if (prompts.length === 0) {
    alert('ไม่มีข้อมูลคำสั่งให้ส่งออกครับ');
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prompts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `prompt-saver-backup-${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showStatus('ส่งออกไฟล์ข้อมูลสำเร็จ');
}

// ฟีเจอร์ใหม่: อ่านไฟล์ JSON ที่อัปโหลดเข้ามาเพื่อแปลงเป็นลิสต์คำสั่ง
function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        const validImported = imported.map((p) => ({
          id: p.id || Date.now().toString() + Math.random(),
          title: p.title || 'Imported Prompt',
          text: p.text || '',
          category: p.category || 'Uncategorized',
          createdAt: p.createdAt || new Date().toISOString(),
          isPinned: p.isPinned || false,
          useCount: p.useCount || 0,
        }));

        // ป้องกันข้อมูลซ้ำซ้อนโดยยึดเลข ID หลัก
        const existingIds = new Set(prompts.map((p) => p.id));
        validImported.forEach((p) => {
          if (!existingIds.has(p.id)) {
            prompts.push(p);
          }
        });

        savePrompts();
        render();
        showStatus('นำเข้าข้อมูลสำเร็จ!');
        event.target.value = ''; // ล้างสถานะกล่องอัปโหลด
      } else {
        alert('รูปแบบไฟล์สำรองไม่ถูกต้อง ไม่ใช่ Array ลิสต์');
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอ่านไฟล์นี้ได้ กรุณาใช้ไฟล์ .json ที่ถูกต้อง');
    }
  };
  reader.readAsText(file);
}

function deletePrompt(id) {
  const shouldDelete = window.confirm('Delete this prompt?');
  if (!shouldDelete) return;

  prompts = prompts.filter((prompt) => prompt.id !== id);
  savePrompts();

  if (editingId === id) {
    resetForm();
  }

  render();
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(''),
  );

  return JSON.parse(jsonPayload);
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  currentUser = {
    id: payload.sub,
    name: payload.name || payload.given_name || 'Google User',
    email: payload.email || '',
    picture: payload.picture || '',
  };

  saveAuthState();
  prompts = loadPrompts();
  render();
  showStatus('Signed in successfully');
}

function initializeGoogleAuth() {
  const clientId = googleClientIdInput.value.trim();
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID' || !window.google?.accounts?.id) {
    authStatus.textContent = 'Paste your Google Client ID above, then refresh the page to enable Google sign-in.';
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
    auto_select: false,
    ux_mode: 'popup',
  });

  window.google.accounts.id.renderButton(googleButton, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    width: 240,
  });

  authStatus.textContent = 'Google sign-in is ready.';
}

function signOut() {
  currentUser = null;
  saveAuthState();
  prompts = loadPrompts();
  resetForm();
  render();
  showStatus('Signed out');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const text = textInput.value.trim();
  const category = normalizeCategory(categoryInput.value || categorySelect.value);

  if (!text) {
    textInput.focus();
    return;
  }

  if (editingId) {
    prompts = prompts.map((prompt) =>
      prompt.id === editingId
        ? { ...prompt, title, text, category }
        : prompt,
    );
  } else {
    prompts.unshift({
      id: Date.now().toString(),
      title,
      text,
      category,
      createdAt: new Date().toISOString(),
      isPinned: false, // เพิ่มค่าเริ่มต้นให้ปุ่มแอดใหม่
      useCount: 0      // เพิ่มค่าเริ่มต้นสถิติใหม่
    });
  }

  savePrompts();
  resetForm();
  render();
});

cancelEditButton.addEventListener('click', resetForm);
searchInput.addEventListener('input', render);
categorySelect.addEventListener('change', () => {
  if (categorySelect.value) {
    categoryInput.value = categorySelect.value;
  }
});
clearCategoryFilterButton.addEventListener('click', () => {
  activeCategory = 'all';
  render();
});
signOutButton.addEventListener('click', signOut);
googleClientIdInput.addEventListener('change', initializeGoogleAuth);

// ผูกฟังก์ชันปุ่มฟีเจอร์ใหม่เข้ากับตัว Event Listeners ตรวจสอบความปลอดภัย
if (exportButton) exportButton.addEventListener('click', exportPrompts);
if (importInput) importInput.addEventListener('change', handleImport);
if (optimizeButton) optimizeButton.addEventListener('click', optimizePromptWithAI);

document.addEventListener('DOMContentLoaded', () => {
  currentUser = loadAuthState();
  prompts = loadPrompts();
  updateFormMode();
  render();
  initializeGoogleAuth();
});