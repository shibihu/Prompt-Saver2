// ============= CONFIGURATION =============
const BACKEND_URL = window.location.hostname.includes('vercel')
  ? 'https://prompt-saver-project.onrender.com'
  : (window.location.origin || 'https://prompt-saver-project.onrender.com');

// ============= LOGIN SECTION =============
const loginWrapper = document.getElementById('loginWrapper');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginSignInForm');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const loginSuccessMsg = document.getElementById('loginSuccessMsg');
const loginLoading = document.getElementById('loginLoading');
const loginNameInput = document.getElementById('loginName');
const loginEmailInput = document.getElementById('loginEmail');

let currentUser = null;
let currentAccessToken = null;



// Load auth state on page load
function loadAuthState() {
  const token = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');

  if (token && user) {
    currentAccessToken = token;
    currentUser = JSON.parse(user);
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginWrapper.classList.remove('hidden');
  appShell.classList.add('hidden');
}

function showApp() {
  loginWrapper.classList.add('hidden');
  appShell.classList.remove('hidden');
  initializeApp();
}

// Handle login form submission and switch into the app shell
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErrorMsg.style.display = 'none';
  loginSuccessMsg.style.display = 'none';

  const name = loginNameInput.value.trim();
  const email = loginEmailInput.value.trim();

  if (!name || !email) {
    loginErrorMsg.textContent = 'Please fill in all fields';
    loginErrorMsg.style.display = 'block';
    return;
  }

  loginLoading.style.display = 'block';

  try {
    const authRes = await fetch(`${BACKEND_URL}/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });

    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData.error || 'Authorization failed');

    const tokenRes = await fetch(`${BACKEND_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode: authData.authCode }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error || 'Token exchange failed');

    localStorage.setItem('accessToken', tokenData.accessToken);
    localStorage.setItem('refreshToken', tokenData.refreshToken);
    localStorage.setItem('user', JSON.stringify(tokenData.user));

    currentAccessToken = tokenData.accessToken;
    currentUser = tokenData.user;

    loginSuccessMsg.textContent = 'Sign in successful! Loading your prompts...';
    loginSuccessMsg.style.display = 'block';

    setTimeout(() => {
      showApp();
    }, 600);
  } catch (error) {
    loginErrorMsg.textContent = `Error: ${error.message}`;
    loginErrorMsg.style.display = 'block';
  } finally {
    loginLoading.style.display = 'none';
  }
});

// ============= APP SECTION =============

// DOM Elements
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
const signOutButton = document.getElementById('sign-out-btn');
const userProfileCard = document.getElementById('user-profile-card');
const userNameMini = document.getElementById('user-name-mini');
const userEmailMini = document.getElementById('user-email-mini');
const userAvatarMini = document.getElementById('user-avatar-mini');
const compactModeToggleBtn = document.getElementById('compact-mode-toggle-btn');
const commandPaletteBtn = document.getElementById('command-palette-btn');

// Command Palette (Ctrl+K / Cmd+K) elements
const commandPaletteOverlay = document.getElementById('commandPaletteOverlay');
const commandPaletteInput = document.getElementById('command-palette-input');
const commandPaletteResults = document.getElementById('command-palette-results');
const commandPaletteEmpty = document.getElementById('command-palette-empty');

// Prompt view/edit modal elements
const editModalOverlay = document.getElementById('editModalOverlay');
const modalTitleInput = document.getElementById('modal-prompt-title');
const modalCategoryInput = document.getElementById('modal-prompt-category');
const modalTextInput = document.getElementById('modal-prompt-text');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let prompts = [];
let editingId = null;
let modalEditingId = null;
let activeCategory = 'all';

// Prevents overlapping toggle-pin requests for the same prompt (race condition guard)
const pendingPinIds = new Set();

// Get storage key per logged-in user context
function getStorageKey() {
  return currentUser ? `prompt-saver-prompts-${currentUser.id}` : 'prompt-saver-prompts-guest';
}

// ดึงข้อมูลจาก API หลังบ้านจริง ๆ ตามสิทธิ์บัญชีที่ล็อกอิน
async function fetchUserPrompts() {
  try {
    if (!currentAccessToken) return [];

    const response = await fetch(`${BACKEND_URL}/api/prompts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch prompts from server');
    
    const serverPrompts = await response.json();
    return serverPrompts;
  } catch (error) {
    console.error('Error fetching prompts from backend:', error);
    showStatus('Error loading from cloud');
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  }
}

// ส่งข้อมูลไปเซฟไว้บนเซิร์ฟเวอร์คลาวด์หลังบ้าน
async function savePromptToServer(prompt) {
  try {
    if (!currentAccessToken) {
      showStatus('Please sign in first');
      return null;
    }

    const response = await fetch(`${BACKEND_URL}/api/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAccessToken}`
      },
      body: JSON.stringify(prompt),
    });

    if (!response.ok) throw new Error('Failed to save prompt to server');

    const updatedPrompts = await response.json();
    localStorage.setItem(getStorageKey(), JSON.stringify(updatedPrompts));
    return updatedPrompts;
  } catch (error) {
    console.error('Error saving prompt to server:', error);
    showStatus('Cloud save failed');
    return null;
  }
}

// ลบข้อมูลบนเซิร์ฟเวอร์หลังบ้าน
async function deletePromptFromServer(id) {
  try {
    if (!currentAccessToken) return null;

    const response = await fetch(`${BACKEND_URL}/api/prompts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete prompt from server');

    const updatedPrompts = await response.json();
    localStorage.setItem(getStorageKey(), JSON.stringify(updatedPrompts));
    return updatedPrompts;
  } catch (error) {
    console.error('Error deleting prompt from server:', error);
    showStatus('Cloud delete failed');
    return null;
  }
}

// Feature: Pin / Favorite toggle — เด้งวัตถุขึ้นด้านบนสุดทันทีแบบรวดเร็ว (Optimistic UI)
async function togglePinPrompt(id) {
  if (pendingPinIds.has(id)) return;

  const targetIndex = prompts.findIndex((item) => item.id === id);
  if (targetIndex === -1) return;

  // 1. เปลี่ยนสถานะฝั่งหน้าจอทันที ไม่ต้องรอน้ำเน็ตเวิร์กวิ่งเสร็จ (Instant Response)
  prompts[targetIndex].isPinned = !prompts[targetIndex].isPinned;
  const newPinState = prompts[targetIndex].isPinned;
  
  // บันทึกลงความจำเครื่องทันทีกันเหนียว
  localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
  render(); // สั่งจัดคิวหน้าจอให้กระโดดขึ้นด้านบนสุดทันที!
  showStatus(newPinState ? 'Prompt pinned to top ✨' : 'Prompt unpinned');

  pendingPinIds.add(id);

  try {
    // 2. แอบคุยกับหลังบ้านเพื่อ Sync ข้อมูล (ลองใช้ทั้งแบบ PUT ตามมาตรฐาน และ POST เผื่อหลังบ้านรองรับไม่เหมือนกัน)
    let response = await fetch(`${BACKEND_URL}/api/prompts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAccessToken}`
      },
      body: JSON.stringify(prompts[targetIndex])
    });

    if (!response.ok) {
      // Fallback: ถ้าหากหลังบ้านไม่มี Route /:id ให้ยิงใส่รูปร่างหลักแบบ POST
      await fetch(`${BACKEND_URL}/api/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentAccessToken}`
        },
        body: JSON.stringify(prompts[targetIndex]),
      });
    }

    // โหลดลิสต์เวอร์ชันล่าสุดมาผสาน เพื่อไม่ให้ระบบคลาวด์เคลียร์ค่าฟิลด์ปักหมุดทิ้ง
    const latestCloudData = await fetchUserPrompts();
    if (latestCloudData && Array.isArray(latestCloudData)) {
      prompts = latestCloudData.map(cloudItem => {
        const localMatch = prompts.find(p => p.id === cloudItem.id);
        return {
          ...cloudItem,
          isPinned: localMatch ? localMatch.isPinned : (cloudItem.isPinned || false)
        };
      });
      localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
      render();
    }
  } catch (error) {
    console.error('Cloud pin sync failed, saved locally instead:', error);
  } finally {
    pendingPinIds.delete(id);
    render();
  }
}

// Feature: Setup Dynamic File Import UI (.txt/.md documents loader)
function setupImportFeature() {
  if (document.getElementById('import-file')) return;

  const searchRow = document.querySelector('.search-row');
  if (!searchRow) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'import-file';
  fileInput.accept = '.txt,.md';
  fileInput.style.display = 'none';

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.id = 'import-btn';
  importBtn.className = 'ghost-btn'; 
  importBtn.textContent = '📥 Import Docs';
  importBtn.style.whiteSpace = 'nowrap';

  searchRow.appendChild(fileInput);
  searchRow.appendChild(importBtn);

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const title = file.name.replace(/\.[^/.]+$/, ""); 

      const importedPrompt = {
        id: Date.now().toString(),
        title: title,
        text: text,
        category: 'Imported Documents',
        createdAt: new Date().toISOString(),
        isPinned: false,
      };

      const updatedPrompts = await savePromptToServer(importedPrompt);
      if (updatedPrompts) {
        prompts = updatedPrompts;
        render();
        showStatus('Document imported!');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });
}

// Feature: Single Prompt Exporter (.md Engine)
function exportSinglePrompt(prompt) {
  const fileContent = `# ${prompt.title || 'Untitled Prompt'}\n\n${prompt.text || ''}`;
  const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `${(prompt.title || 'prompt').replace(/[/\\?%*:|"<>]/g, '-')}.md`;
  downloadLink.click();
  URL.revokeObjectURL(url);
  showStatus('Prompt exported!');
}

// Feature: System-wide Global Database Exporter (JSON Engine)
function exportSystemBackup() {
  if (prompts.length === 0) {
    alert('No prompts available to export into a backup.');
    return;
  }
  const fileData = JSON.stringify(prompts, null, 2);
  const blob = new Blob([fileData], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `PromptSaver-Backup-${currentUser ? currentUser.name : 'Guest'}-${new Date().toISOString().split('T')[0]}.json`;
  downloadLink.click();
  URL.revokeObjectURL(url);
  showStatus('Backup database exported!');
}

// Feature: System-wide Global Database Restoration Engine
function triggerSystemBackupImport() {
  const backupInput = document.getElementById('system-backup-file-handler');
  if (backupInput) backupInput.click();
}

async function uploadBackupDataToCloud(parsedBackupData) {
  showStatus('Restoring and syncing to cloud... Please wait.');
  try {
    const response = await fetch(`${BACKEND_URL}/api/prompts/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAccessToken}`
      },
      body: JSON.stringify(parsedBackupData),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to import backup data');
    }

    const updatedPrompts = await response.json();
    prompts = updatedPrompts;
    localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
    render();
    showStatus('System database restored & synced to cloud!');
  } catch (error) {
    console.error('Error importing backup:', error);
    showStatus('Backup import failed');
  }
}

function processSystemBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      const parsedBackupData = JSON.parse(e.target.result);
      if (!Array.isArray(parsedBackupData)) {
        showStatus('Invalid backup file format');
        return;
      }
      
      const shouldImport = await showCustomConfirm(
        'Restore Backup',
        `Are you sure you want to load this backup? It will replace your current list of ${prompts.length} prompts.`,
        'Restore',
        'copy-btn'
      );
      
      if (shouldImport) {
        await uploadBackupDataToCloud(parsedBackupData);
      }
    } catch (err) {
      showStatus('Error parsing backup file');
    }
  };
  reader.readAsText(file);
}

// Dynamic Backup Component Injection Controller
function setupPremiumBackupUI() {
  let backupPanel = document.getElementById('app-backup-hub-panel');
  if (!backupPanel && userProfileCard) {
    backupPanel = document.createElement('div');
    backupPanel.id = 'app-backup-hub-panel';
    backupPanel.className = 'backup-hub-panel';
    
    backupPanel.innerHTML = `
      <div class="backup-panel-title">⚙️ System Storage Backup</div>
      <div class="backup-grid-actions">
        <button type="button" class="backup-action-control export-master-btn" id="master-export-action-btn">📤 Export</button>
        <button type="button" class="backup-action-control import-master-btn" id="master-import-action-btn">📥 Import</button>
      </div>
      <input type="file" id="system-backup-file-handler" accept=".json" style="display:none;" />
    `;
    
    userProfileCard.parentNode.insertBefore(backupPanel, userProfileCard.nextSibling);
    
    document.getElementById('master-export-action-btn').addEventListener('click', exportSystemBackup);
    document.getElementById('master-import-action-btn').addEventListener('click', triggerSystemBackupImport);
    document.getElementById('system-backup-file-handler').addEventListener('change', (e) => processSystemBackupFile(e.target.files[0]));
  }
}

// UI Functions
function normalizeCategory(value) {
  const category = (value || '').trim();
  return category || 'Uncategorized';
}

// Utility mapper logic
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
  let exportBtn = document.getElementById('export-edit-btn');
  
  if (editingId) {
    saveButton.textContent = 'Update Prompt';
    cancelEditButton.classList.remove('hidden');
    
    if (!exportBtn) {
      exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.id = 'export-edit-btn';
      exportBtn.className = 'ghost-btn';
      exportBtn.textContent = '📤 Export File';
      
      cancelEditButton.parentNode.insertBefore(exportBtn, cancelEditButton);
      
      exportBtn.addEventListener('click', () => {
        const activeEditingPrompt = prompts.find(p => p.id === editingId);
        if (activeEditingPrompt) exportSinglePrompt(activeEditingPrompt);
      });
    }
    exportBtn.classList.remove('hidden');
  } else {
    saveButton.textContent = 'Save Prompt';
    cancelEditButton.classList.add('hidden');
    if (exportBtn) exportBtn.classList.add('hidden');
  }
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
    const matchesCategory = prompt.isPinned || activeCategory === 'all' || categoryName === activeCategory;
    return matchesQuery && matchesCategory;
  });
}

function sortWithPinnedFirst(listData) {
  return [...listData].sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

function renderPrompts() {
  // กรองข้อมูลและจัดเรียงลำดับด่วน: ให้เอาอันที่ถูกติ๊กเป็น Pinned กระโดดข้ามแถวมาอยู่บนสุดก่อนเสมอ
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
    item.className = `prompt-card ${prompt.isPinned ? 'pinned-card' : ''}`;
    item.dataset.id = prompt.id;

    const header = document.createElement('header');
    const titleRow = document.createElement('div');
    titleRow.className = 'prompt-title-row';

    const title = document.createElement('h3');
    title.className = 'prompt-title';
    title.textContent = (prompt.isPinned ? '⭐ ' : '') + (prompt.title || 'Untitled Prompt');

    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.textContent = getCategoryName(prompt);

    titleRow.append(title, badge);
    header.appendChild(titleRow);

    const meta = document.createElement('span');
    meta.className = 'prompt-meta';
    meta.textContent = prompt.createdAt ? new Date(prompt.createdAt).toLocaleString() : 'Just now';
    header.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';

    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = `pin-btn ${prompt.isPinned ? 'active-pin' : 'ghost-btn'}`;
    pinButton.textContent = prompt.isPinned ? '📌 Unpin' : '⭐ Pin';
    pinButton.disabled = pendingPinIds.has(prompt.id);
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

    actions.append(pinButton, copyButton, editButton, deleteButton);
    item.append(header, actions);
    list.appendChild(item);
  });
}

function renderUserProfile() {
  if (currentUser) {
    userProfileCard.classList.remove('hidden');
    userNameMini.textContent = currentUser.name || 'User';
    userEmailMini.textContent = currentUser.email || '';
    userAvatarMini.src = currentUser.picture || 'https://www.gravatar.com/avatar?d=mp';
    setupPremiumBackupUI(); 
  }
}

function render() {
  populateCategorySelect();
  renderSidebar();
  renderPrompts();
  renderUserProfile();
}

function startEditing(id) {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return;

  modalEditingId = id;
  modalTitleInput.value = prompt.title || '';
  modalCategoryInput.value = getCategoryName(prompt);
  modalTextInput.value = prompt.text || '';
  openEditModal();
}

function openEditModal() {
  editModalOverlay.classList.remove('hidden');
  modalTitleInput.focus();
}

function closeEditModal() {
  editModalOverlay.classList.add('hidden');
  modalEditingId = null;
  modalTitleInput.value = '';
  modalCategoryInput.value = '';
  modalTextInput.value = '';
}

async function saveModalEdit() {
  if (!modalEditingId) return;

  const original = prompts.find((p) => p.id === modalEditingId);
  if (!original) return;

  const updated = {
    ...original,
    title: modalTitleInput.value.trim(),
    category: normalizeCategory(modalCategoryInput.value),
    text: modalTextInput.value.trim(),
  };

  const updatedPrompts = await savePromptToServer(updated);
  if (updatedPrompts) {
    // ผสานเพื่อรักษาฟิลด์พินไม่ให้โดนรีเซ็ต
    prompts = updatedPrompts.map(item => ({
      ...item,
      isPinned: item.id === original.id ? original.isPinned : (item.isPinned || false)
    }));
    closeEditModal();
    render();
    showStatus('Prompt updated');
  }
}

modalSaveBtn.addEventListener('click', saveModalEdit);
modalCancelBtn.addEventListener('click', closeEditModal);
modalCloseBtn.addEventListener('click', closeEditModal);
editModalOverlay.addEventListener('click', (event) => {
  if (event.target === editModalOverlay) closeEditModal();
});

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
}

function showCustomConfirm(title, message, confirmText = 'Delete', confirmClass = 'delete-btn') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
    const closeBtn = document.getElementById('confirm-modal-close-btn');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = confirmClass;

    const cleanup = (value) => {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      closeBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      resolve(value);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onOverlayClick = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    closeBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);

    overlay.classList.remove('hidden');
  });
}

async function deletePrompt(id) {
  const shouldDelete = await showCustomConfirm(
    'Delete Prompt',
    'Are you sure you want to delete this prompt? This action cannot be undone.'
  );
  if (!shouldDelete) return;

  const updatedPrompts = await deletePromptFromServer(id);
  if (updatedPrompts) {
    prompts = updatedPrompts;
    if (String(editingId) === String(id)) {
      resetForm();
    }
    render();
    showStatus('Prompt deleted');
  }
}

function signOut() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  
  currentUser = null;
  currentAccessToken = null;
  prompts = [];
  
  const dynamicPanel = document.getElementById('app-backup-hub-panel');
  if (dynamicPanel) dynamicPanel.remove();

  resetForm();
  showLogin();
}

// ============= AI PROMPT OPTIMIZER (Gemini) =============
const optimizeButton = document.getElementById('optimize-btn');

async function optimizePromptWithAI() {
  const originalText = textInput.value.trim();
  if (!originalText) {
    alert('กรุณาพิมพ์ข้อความลงในช่อง Prompt ก่อนกด Optimize ครับ!');
    return;
  }

  optimizeButton.disabled = true;
  optimizeButton.textContent = '🪄 Optimizing...';

  try {
    const API_KEY = 'YOUR_GEMINI_API_KEY';

    if (API_KEY === 'YOUR_GEMINI_API_KEY') {
      await new Promise((resolve) => setTimeout(resolve, 900));
      textInput.value = `[Optimized ✨] Act as an Expert.\n\n[Context]\n${originalText}\n\n[Objective]\nProvide a comprehensive, high-quality output based on the details above. Avoid superficial answers and structure it clearly.`;
      showStatus('Prompt optimized! (mock mode)');
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert Prompt Engineer. Optimize the following draft prompt to make it clear, well-structured, and highly effective for an LLM. Keep the original intent intact but add structured sections like Role, Context, and Constraints if applicable. Only return the optimized prompt text without any introductory remarks or markdown code blocks:\n\n${originalText}`,
            }],
          }],
        }),
      }
    );

    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      textInput.value = data.candidates[0].content.parts[0].text.trim();
      showStatus('Prompt optimized!');
    } else {
      throw new Error('Unexpected API response shape');
    }
  } catch (error) {
    console.error('AI Optimization failed:', error);
    showStatus('Optimize failed — check API key in code');
  } finally {
    optimizeButton.disabled = false;
    optimizeButton.textContent = '✨ Optimize Prompt';
  }
}

if (optimizeButton) optimizeButton.addEventListener('click', optimizePromptWithAI);

// ============= COMMAND PALETTE (Ctrl+K / Cmd+K) =============
let paletteResults = [];
let paletteActiveIndex = -1;

function isCommandPaletteOpen() {
  return !commandPaletteOverlay.classList.contains('hidden');
}

function openCommandPalette() {
  if (!currentUser) return; 
  commandPaletteOverlay.classList.remove('hidden');
  commandPaletteInput.value = '';
  renderCommandPaletteResults('');
  window.setTimeout(() => commandPaletteInput.focus(), 0);
}

function closeCommandPalette() {
  commandPaletteOverlay.classList.add('hidden');
  commandPaletteInput.value = '';
  paletteResults = [];
  paletteActiveIndex = -1;
  commandPaletteResults.innerHTML = '';
}

function toggleCommandPalette() {
  if (isCommandPaletteOpen()) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function renderCommandPaletteResults(query) {
  const normalizedQuery = query.trim().toLowerCase();

  paletteResults = sortWithPinnedFirst(
    prompts.filter((prompt) => {
      const categoryName = getCategoryName(prompt);
      const haystack = `${prompt.title} ${prompt.text} ${categoryName}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
  ).slice(0, 30);

  commandPaletteResults.innerHTML = '';
  paletteActiveIndex = paletteResults.length > 0 ? 0 : -1;

  if (paletteResults.length === 0) {
    commandPaletteEmpty.classList.remove('hidden');
    return;
  }
  commandPaletteEmpty.classList.add('hidden');

  paletteResults.forEach((prompt, index) => {
    const li = document.createElement('li');
    li.className = `command-palette-result${index === 0 ? ' active' : ''}`;
    li.dataset.index = String(index);

    const titleRow = document.createElement('div');
    titleRow.className = 'command-palette-result-title';
    titleRow.textContent = `${prompt.isPinned ? '⭐ ' : ''}${prompt.title || 'Untitled Prompt'}`;

    const snippet = document.createElement('div');
    snippet.className = 'command-palette-result-snippet';
    snippet.textContent = (prompt.text || '').slice(0, 90);

    li.append(titleRow, snippet);
    li.addEventListener('mouseenter', () => setPaletteActiveIndex(index));
    li.addEventListener('click', () => copyFromCommandPalette(index));
    commandPaletteResults.appendChild(li);
  });
}

function setPaletteActiveIndex(index) {
  if (paletteResults.length === 0) return;
  paletteActiveIndex = (index + paletteResults.length) % paletteResults.length;
  Array.from(commandPaletteResults.children).forEach((child, i) => {
    child.classList.toggle('active', i === paletteActiveIndex);
  });
  const activeEl = commandPaletteResults.children[paletteActiveIndex];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

async function copyFromCommandPalette(index) {
  const prompt = paletteResults[index];
  if (!prompt) return;
  await copyPrompt(prompt);
  closeCommandPalette();
}

commandPaletteInput.addEventListener('input', (event) => {
  renderCommandPaletteResults(event.target.value);
});

commandPaletteOverlay.addEventListener('click', (event) => {
  if (event.target === commandPaletteOverlay) closeCommandPalette();
});

if (commandPaletteBtn) {
  commandPaletteBtn.addEventListener('click', toggleCommandPalette);
}

// Global Keyboard Handler
document.addEventListener('keydown', (event) => {
  const isKShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  if (isKShortcut) {
    event.preventDefault();
    toggleCommandPalette();
    return;
  }

  if (event.key === 'Escape') {
    if (isCommandPaletteOpen()) {
      event.preventDefault();
      closeCommandPalette();
      return;
    }
    if (!editModalOverlay.classList.contains('hidden')) {
      closeEditModal();
      return;
    }
  }

  if (isCommandPaletteOpen()) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPaletteActiveIndex(paletteActiveIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPaletteActiveIndex(paletteActiveIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (paletteActiveIndex >= 0) copyFromCommandPalette(paletteActiveIndex);
    }
  }
});

// ============= COMPACT SIDEBAR MODE =============
const COMPACT_MODE_STORAGE_KEY = 'prompt-saver-compact-mode';

function applyCompactMode(isCompact) {
  appShell.classList.toggle('compact-mode', isCompact);
  compactModeToggleBtn.classList.toggle('active', isCompact);
  compactModeToggleBtn.textContent = isCompact ? '🗔 Exit Compact' : '🗔 Compact';
}

function toggleCompactMode() {
  const isCompact = !appShell.classList.contains('compact-mode');
  applyCompactMode(isCompact);
  try {
    localStorage.setItem(COMPACT_MODE_STORAGE_KEY, isCompact ? '1' : '0');
  } catch (error) {
    // Ignore storage errors
  }
}

compactModeToggleBtn.addEventListener('click', toggleCompactMode);

// Form Submit Event Handler (Fixed Order & Declarations)
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const title = titleInput.value.trim();
  const text = textInput.value.trim();
  const category = normalizeCategory(categoryInput.value || categorySelect.value);

  if (!text) {
    textInput.focus();
    return;
  }

  const existing = editingId ? prompts.find((p) => p.id === editingId) : null;

  const prompt = {
    id: editingId || Date.now().toString(),
    title,
    text,
    category,
    createdAt: existing?.createdAt || new Date().toISOString(),
    isPinned: existing ? (existing.isPinned || false) : false,
  };

  const updatedPrompts = await savePromptToServer(prompt);
  if (updatedPrompts) {
    prompts = updatedPrompts;
    resetForm();
    render();
    showStatus(editingId ? 'Prompt updated' : 'Prompt saved');
  }
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

// Initialize App
async function initializeApp() {
  renderUserProfile();
  
  // นำข้อมูล Local มา Render วาดหน้าจอทันทีเพื่อความเร็ว ไม่ต้องง้อ Cold Start หลังบ้าน
  const localCache = localStorage.getItem(getStorageKey());
  if (localCache) {
    prompts = JSON.parse(localCache);
    render();
  }

  // แอบดาวน์โหลดข้อมูลจริงจากคลาวด์มา Sync อัปเดตผสานกันทีหลัง
  const serverPrompts = await fetchUserPrompts(); 
  if (serverPrompts && Array.isArray(serverPrompts)) {
    prompts = serverPrompts.map(sp => {
      const localMatch = prompts.find(lp => lp.id === sp.id);
      return {
        ...sp,
        isPinned: localMatch ? localMatch.isPinned : (sp.isPinned || false)
      };
    });
    localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
  }

  setupImportFeature();
  updateFormMode();
  try {
    applyCompactMode(localStorage.getItem(COMPACT_MODE_STORAGE_KEY) === '1');
  } catch (error) {
    // Ignore storage errors
  }
  render();
}

document.addEventListener('DOMContentLoaded', loadAuthState);