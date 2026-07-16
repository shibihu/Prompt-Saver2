// ============= CONFIGURATION =============
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isRender = window.location.hostname.includes('prompt-saver-project.onrender.com') || window.location.hostname.includes('onrender.com');
const BACKEND_URL = (isLocal || isRender)
  ? window.location.origin
  : 'https://prompt-saver-project.onrender.com';

// ============= LOGIN SECTION =============
const loginWrapper = document.getElementById('loginWrapper');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginSignInForm');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const loginSuccessMsg = document.getElementById('loginSuccessMsg');
const loginLoading = document.getElementById('loginLoading');
const loginNameInput = document.getElementById('loginName');
const loginEmailInput = document.getElementById('loginEmail');

// Account Chooser Elements
const accountChooserContainer = document.getElementById('accountChooserContainer');
const manualLoginContainer = document.getElementById('manualLoginContainer');
const addAnotherAccountBtn = document.getElementById('addAnotherAccountBtn');
const backToAccountsBtn = document.getElementById('backToAccountsBtn');
const disclosurePrivacyLink = document.getElementById('disclosure-privacy-link');
const disclosureTermsLink = document.getElementById('disclosure-terms-link');

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

function getGoogleAvatarUrl(name) {
  const firstLetter = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#1a73e8', '#ea4335', '#f9ab00', '#34a853'];
  const charCode = firstLetter.charCodeAt(0);
  const color = colors[charCode % colors.length];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="64" fill="${color}" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="'Product Sans', 'Google Sans', Roboto, sans-serif" font-weight="500" font-size="64">${firstLetter}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// Wire up Account Chooser actions
if (addAnotherAccountBtn) {
  addAnotherAccountBtn.addEventListener('click', () => {
    accountChooserContainer.classList.add('hidden');
    manualLoginContainer.classList.remove('hidden');
  });
}

if (backToAccountsBtn) {
  backToAccountsBtn.addEventListener('click', () => {
    manualLoginContainer.classList.add('hidden');
    accountChooserContainer.classList.remove('hidden');
    loginErrorMsg.style.display = 'none';
  });
}

if (disclosurePrivacyLink) {
  disclosurePrivacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Privacy Policy: Prompt Saver stores your workspace and active sessions locally on this machine and synchronizes securely with your personal database profile.');
  });
}

if (disclosureTermsLink) {
  disclosureTermsLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Terms of Service: Prompt Saver is a secure offline-first workspace helper designed to keep your creative assets accessible and highly organized.');
  });
}

// Global Firebase variables
let firebaseAuth = null;

// Initialize Firebase Auth
async function initFirebase() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/firebase-config`);
    if (!res.ok) throw new Error('Could not load Firebase config');
    const firebaseConfig = await res.json();
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    console.log('Firebase initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
  }
}

// Call initFirebase immediately
initFirebase();

// Register message listener for direct Google or GitHub OAuth callback popups
window.addEventListener('message', async (event) => {
  if (event.data && (event.data.type === 'GOOGLE_OAUTH_SUCCESS' || event.data.type === 'GITHUB_OAUTH_SUCCESS')) {
    const { user } = event.data;
    try {
      loginLoading.style.display = 'block';
      accountChooserContainer.style.opacity = '0.5';
      
      // Exchange profile for App session tokens
      const authRes = await fetch(`${BACKEND_URL}/oauth/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name }),
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

      // Attach the avatar picture if available
      if (user.picture) {
        tokenData.user.picture = user.picture;
      }

      localStorage.setItem('accessToken', tokenData.accessToken);
      localStorage.setItem('refreshToken', tokenData.refreshToken);
      localStorage.setItem('user', JSON.stringify(tokenData.user));

      currentAccessToken = tokenData.accessToken;
      currentUser = tokenData.user;

      loginLoading.style.display = 'none';
      loginSuccessMsg.textContent = `Welcome back, ${currentUser.name}! Redirecting...`;
      loginSuccessMsg.style.display = 'block';

      setTimeout(() => {
        showApp();
        accountChooserContainer.style.opacity = '1';
        loginLoading.style.display = 'none';
      }, 600);
    } catch (error) {
      accountChooserContainer.style.opacity = '1';
      loginLoading.style.display = 'none';
      loginErrorMsg.textContent = `Sign-In Error: ${error.message}`;
      loginErrorMsg.style.display = 'block';
    }
  }
});

async function initiateDirectGoogleSignIn() {
  loginLoading.style.display = 'block';
  accountChooserContainer.style.opacity = '0.5';
  
  try {
    let clientId = "276434759121-87rfkcqrjhpo5fdp4k9d3iudg3t7b95u.apps.googleusercontent.com";
    try {
      const res = await fetch(`${BACKEND_URL}/api/firebase-config`);
      if (res.ok) {
        const config = await res.json();
        if (config.oAuthClientId) {
          clientId = config.oAuthClientId;
        }
      }
    } catch (e) {
      console.warn("Could not fetch Google Client ID from API, using fallback", e);
    }

    const redirectUri = encodeURIComponent(`${BACKEND_URL}/auth/google/callback`);
    const scope = encodeURIComponent('email profile openid');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=select_account`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(authUrl, 'GoogleSignIn', `width=${width},height=${height},left=${left},top=${top}`);
    if (popup) {
      popup.focus();
    } else {
      throw new Error('Popup blocked! Please allow popups for this website to sign in.');
    }
  } catch (error) {
    accountChooserContainer.style.opacity = '1';
    loginLoading.style.display = 'none';
    loginErrorMsg.textContent = `Google Sign-In Error: ${error.message}`;
    loginErrorMsg.style.display = 'block';
  }
}

async function initiateGitHubSignIn() {
  loginLoading.style.display = 'block';
  accountChooserContainer.style.opacity = '0.5';
  
  try {
    let clientId = "";
    const res = await fetch(`${BACKEND_URL}/api/github-config`);
    if (res.ok) {
      const config = await res.json();
      clientId = config.clientId;
    }
    
    if (!clientId) {
      throw new Error('GitHub Client ID is not configured on the server. Please add GITHUB_CLIENT_ID to the backend environment variables.');
    }

    const redirectUri = encodeURIComponent(`${BACKEND_URL}/auth/github/callback`);
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;

    const width = 550;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(authUrl, 'GitHubSignIn', `width=${width},height=${height},left=${left},top=${top}`);
    if (popup) {
      popup.focus();
    } else {
      throw new Error('Popup blocked! Please allow popups for this website to sign in.');
    }
  } catch (error) {
    accountChooserContainer.style.opacity = '1';
    loginLoading.style.display = 'none';
    loginErrorMsg.textContent = `GitHub Sign-In Error: ${error.message}`;
    loginErrorMsg.style.display = 'block';
  }
}

// Real Google Sign-In Action
const realGoogleSignInBtn = document.getElementById('realGoogleSignInBtn');

if (realGoogleSignInBtn) {
  realGoogleSignInBtn.addEventListener('click', async () => {
    loginErrorMsg.style.display = 'none';
    loginSuccessMsg.style.display = 'none';
    
    if (!firebaseAuth) {
      console.log('Firebase is not loaded, using direct Google OAuth...');
      initiateDirectGoogleSignIn();
      return;
    }
    
    loginLoading.style.display = 'block';
    accountChooserContainer.style.opacity = '0.5';
    
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      // Force account selection screen
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await firebaseAuth.signInWithPopup(provider);
      const user = result.user;
      
      if (!user || !user.email) {
        throw new Error('Google did not return an email address');
      }
      
      // Exchange Google profile for App session tokens
      const authRes = await fetch(`${BACKEND_URL}/oauth/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.displayName || user.email }),
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

      // Attach the Google avatar picture if available
      if (user.photoURL) {
        tokenData.user.picture = user.photoURL;
      }

      localStorage.setItem('accessToken', tokenData.accessToken);
      localStorage.setItem('refreshToken', tokenData.refreshToken);
      localStorage.setItem('user', JSON.stringify(tokenData.user));

      currentAccessToken = tokenData.accessToken;
      currentUser = tokenData.user;

      loginLoading.style.display = 'none';
      loginSuccessMsg.textContent = `Welcome back, ${currentUser.name}! Redirecting...`;
      loginSuccessMsg.style.display = 'block';

      setTimeout(() => {
        showApp();
        accountChooserContainer.style.opacity = '1';
        loginLoading.style.display = 'none';
      }, 600);
    } catch (error) {
      console.warn("Firebase Auth popup failed, attempting direct Google OAuth fallback:", error);
      if (error.code === 'auth/unauthorized-domain' || error.message.includes('unauthorized') || error.message.includes('domain') || error.message.includes('refused') || error.message.includes('blocked') || error.code === 'auth/popup-blocked') {
        // Fallback directly to direct Google OAuth 2.0 popup
        initiateDirectGoogleSignIn();
      } else {
        accountChooserContainer.style.opacity = '1';
        loginLoading.style.display = 'none';
        loginErrorMsg.textContent = `Google Sign-In Error: ${error.message}`;
        loginErrorMsg.style.display = 'block';
      }
    }
  });
}

// Real GitHub Sign-In Action
const realGitHubSignInBtn = document.getElementById('realGitHubSignInBtn');

if (realGitHubSignInBtn) {
  realGitHubSignInBtn.addEventListener('click', async () => {
    loginErrorMsg.style.display = 'none';
    loginSuccessMsg.style.display = 'none';
    initiateGitHubSignIn();
  });
}

// Handle custom login form submission and switch into the app shell
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

// Folder Organizer & custom input modal elements
const clearFolderFilterButton = document.getElementById('clear-folder-filter');
const folderList = document.getElementById('folder-list');
const sidebarAddFolderBtn = document.getElementById('sidebar-add-folder-btn');

const folderModalOverlay = document.getElementById('folderModalOverlay');
const folderModalPromptTitle = document.getElementById('folder-modal-prompt-title');
const newFolderInput = document.getElementById('new-folder-input');
const existingFoldersList = document.getElementById('existing-folders-list');
let folderModalTitle = document.getElementById('folder-modal-title');
let folderModalCloseBtn = document.getElementById('folder-modal-close-btn');
let folderModalCancelBtn = document.getElementById('folder-modal-cancel-btn');
let folderModalRemoveBtn = document.getElementById('folder-modal-remove-btn');
let createFolderBtn = document.getElementById('create-folder-btn');

const inputModalOverlay = document.getElementById('inputModalOverlay');
const inputModalTitle = document.getElementById('input-modal-title');
const inputModalMessage = document.getElementById('input-modal-message');
const customModalInput = document.getElementById('custom-modal-input');
const inputModalCloseBtn = document.getElementById('input-modal-close-btn');
const inputModalCancelBtn = document.getElementById('input-modal-cancel-btn');
const inputModalSubmitBtn = document.getElementById('input-modal-submit-btn');

let prompts = [];
let editingId = null;
let modalEditingId = null;
let activeCategory = 'all';
let activeFolder = 'all';
let customFolders = [];

function loadCustomFolders() {
  try {
    const key = `custom_folders_${currentUser ? currentUser.email : 'local'}`;
    const stored = localStorage.getItem(key);
    customFolders = stored ? JSON.parse(stored) : [];
  } catch (err) {
    customFolders = [];
  }
}

function saveCustomFolders() {
  try {
    const key = `custom_folders_${currentUser ? currentUser.email : 'local'}`;
    localStorage.setItem(key, JSON.stringify(customFolders));
  } catch (err) {}
}

function getFolders() {
  const folderSet = new Set();
  customFolders.forEach(f => {
    if (f && f.trim()) folderSet.add(f.trim());
  });
  prompts.forEach((p) => {
    if (p.folder && p.folder.trim()) {
      folderSet.add(p.folder.trim());
    }
  });
  return Array.from(folderSet).sort();
}

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
  importBtn.style.display = 'inline-flex';
  importBtn.style.alignItems = 'center';
  importBtn.style.gap = '6px';
  importBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg><span>Import Docs</span>`;
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
      let errMsg = 'Failed to import backup data';
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch (jsonErr) {
        errMsg = `Server returned status ${response.status}`;
      }
      throw new Error(errMsg);
    }

    const updatedPrompts = await response.json();
    prompts = updatedPrompts;
    localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
    
    // Auto-populate folders from database
    const foldersInBackup = [...new Set(prompts.map(p => p.folder).filter(f => f && f.trim() !== ''))];
    foldersInBackup.forEach(f => {
      if (!customFolders.includes(f)) {
        customFolders.push(f);
      }
    });
    saveCustomFolders();
    
    render();
    showStatus('System database restored & synced to cloud!');
  } catch (error) {
    console.error('Error importing backup via batch API:', error);
    
    // Fallback: Local Browser Restore (Offline/Resilient mode)
    showStatus('Batch sync failed. Running local restoration...');
    
    const restoredLocalPrompts = parsedBackupData.map((p, idx) => {
      return {
        id: p.id ? String(p.id) : (Date.now() + idx).toString(),
        title: p.title || 'Imported Prompt',
        text: p.text || p.content || '',
        category: p.category || 'Uncategorized',
        createdAt: p.createdAt || new Date().toISOString(),
        isPinned: p.isPinned || false,
        useCount: p.useCount !== undefined ? Number(p.useCount) : 0,
        folder: p.folder || ''
      };
    });
    
    prompts = restoredLocalPrompts;
    localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
    
    // Auto-populate folders from backup
    const foldersInBackup = [...new Set(restoredLocalPrompts.map(p => p.folder).filter(f => f && f.trim() !== ''))];
    foldersInBackup.forEach(f => {
      if (!customFolders.includes(f)) {
        customFolders.push(f);
      }
    });
    saveCustomFolders();
    
    render();
    showStatus('Local restore complete! Syncing to cloud...');
    
    // Try to sync individually
    let successCount = 0;
    for (const prompt of restoredLocalPrompts) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/prompts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentAccessToken}`
          },
          body: JSON.stringify(prompt),
        });
        if (response.ok) {
          successCount++;
        }
      } catch (err) {
        console.error('Failed to sync individual prompt:', prompt, err);
      }
    }
    
    if (successCount > 0) {
      showStatus(`Sync complete! ${successCount}/${restoredLocalPrompts.length} prompts backed up to cloud.`);
      // Fetch latest from server to be clean
      const serverPrompts = await fetchUserPrompts();
      if (serverPrompts && Array.isArray(serverPrompts)) {
        prompts = serverPrompts;
        localStorage.setItem(getStorageKey(), JSON.stringify(prompts));
        render();
      }
    } else {
      showStatus('Local restore complete! (Offline Mode)');
    }
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
      <div class="backup-panel-title" style="display: flex; align-items: center; gap: 6px;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
        <span>System Storage Backup</span>
      </div>
      <div class="backup-grid-actions">
        <button type="button" class="backup-action-control export-master-btn" id="master-export-action-btn" style="display: flex; align-items: center; justify-content: center; gap: 6px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>Export</button>
        <button type="button" class="backup-action-control import-master-btn" id="master-import-action-btn" style="display: flex; align-items: center; justify-content: center; gap: 6px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Import</button>
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
    const folderName = prompt.folder || '';
    const haystack = `${prompt.title} ${prompt.text} ${categoryName} ${folderName}`.toLowerCase();
    const matchesQuery = haystack.includes(query);
    const matchesCategory = prompt.isPinned || activeCategory === 'all' || categoryName === activeCategory;
    const matchesFolder = prompt.isPinned || activeFolder === 'all' || folderName === activeFolder;
    return matchesQuery && matchesCategory && matchesFolder;
  });
}

function sortWithPinnedFirst(listData) {
  return [...listData].sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

function renderPrompts() {
  const query = searchInput.value.trim().toLowerCase();
  
  // Clear the list
  list.innerHTML = '';
  
  // Setup the titles/subtitles
  let displayTitle = activeCategory === 'all' ? 'All prompts' : `${activeCategory} prompts`;
  if (activeFolder !== 'all') {
    listTitle.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg><span>${activeFolder}</span></span>`;
  } else {
    listTitle.textContent = displayTitle;
  }

  // Let's get the filtered prompts
  const filteredPrompts = getFilteredPrompts().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  // If we are inside a specific folder, show a navigation banner at the very top of the list
  if (activeFolder !== 'all') {
    const navBanner = document.createElement('div');
    navBanner.className = 'folder-navigation-banner';
    
    const leftSide = document.createElement('div');
    leftSide.className = 'folder-nav-left';
    
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'back-link-btn';
    backBtn.innerHTML = '← Back to All folders';
    backBtn.addEventListener('click', () => {
      activeFolder = 'all';
      render();
    });
    
    const currentFolderText = document.createElement('span');
    currentFolderText.className = 'current-folder-title';
    currentFolderText.textContent = `Folder: ${activeFolder}`;
    
    leftSide.append(backBtn, currentFolderText);
    navBanner.appendChild(leftSide);
    
    const rightSide = document.createElement('div');
    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className = 'ghost-btn';
    manageBtn.style.padding = '0.35rem 0.6rem';
    manageBtn.style.fontSize = '0.85rem';
    manageBtn.style.display = 'inline-flex';
    manageBtn.style.alignItems = 'center';
    manageBtn.style.gap = '6px';
    manageBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg><span>Manage Folder</span>`;
    manageBtn.addEventListener('click', () => {
      manageFolderOptions(activeFolder);
    });
    rightSide.appendChild(manageBtn);
    navBanner.appendChild(rightSide);
    
    list.appendChild(navBanner);
  }

  // If search query is empty and we are at the ROOT (activeFolder === 'all'), we render Folder Cards first
  if (query === '' && activeFolder === 'all') {
    const folders = getFolders();
    folders.forEach((folder) => {
      const folderPromptsCount = prompts.filter(p => (p.folder || '') === folder).length;
      
      const folderCard = document.createElement('li');
      folderCard.className = 'workspace-folder-card';
      folderCard.style.marginBottom = '0.75rem';
      
      const info = document.createElement('div');
      info.className = 'folder-card-info';
      
      const icon = document.createElement('div');
      icon.className = 'folder-card-icon';
      icon.style.display = 'inline-flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>`;
      
      const details = document.createElement('div');
      details.className = 'folder-card-details';
      
      const name = document.createElement('h3');
      name.className = 'folder-card-name';
      name.textContent = folder;
      
      const count = document.createElement('span');
      count.className = 'folder-card-count';
      count.textContent = `${folderPromptsCount} ${folderPromptsCount === 1 ? 'prompt' : 'prompts'}`;
      
      details.append(name, count);
      info.append(icon, details);
      folderCard.append(info);
      
      // Action buttons on the right side of the folder card
      const actions = document.createElement('div');
      actions.className = 'folder-card-actions';
      
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'ghost-btn';
      openBtn.style.fontSize = '0.85rem';
      openBtn.textContent = 'Open';
      openBtn.style.padding = '0.4rem 0.8rem';
      
      const manageBtn = document.createElement('button');
      manageBtn.type = 'button';
      manageBtn.className = 'ghost-btn';
      manageBtn.style.padding = '0.4rem';
      manageBtn.style.display = 'inline-flex';
      manageBtn.style.alignItems = 'center';
      manageBtn.style.justifyContent = 'center';
      manageBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
      manageBtn.title = 'Manage folder';
      
      manageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        manageFolderOptions(folder);
      });
      
      actions.append(openBtn, manageBtn);
      folderCard.appendChild(actions);
      
      // Clicking the card opens the folder
      folderCard.addEventListener('click', () => {
        activeFolder = folder;
        render();
      });
      
      list.appendChild(folderCard);
    });
  }

  // Determine what prompts to display:
  // If we are on activeFolder === 'all' and there is NO search query, we only display root prompts (no folder)
  // Otherwise, we display whatever is in filteredPrompts.
  let promptsToDisplay = filteredPrompts;
  if (query === '' && activeFolder === 'all') {
    promptsToDisplay = filteredPrompts.filter(p => !p.folder || p.folder.trim() === '');
  }

  // Update summary count
  const promptCountText = `${promptsToDisplay.length} ${promptsToDisplay.length === 1 ? 'prompt' : 'prompts'}`;
  if (activeFolder === 'all' && query === '') {
    listSummary.textContent = `${getFolders().length} folders, ${promptCountText} unassigned`;
  } else {
    listSummary.textContent = promptCountText;
  }

  if (promptsToDisplay.length === 0) {
    if (list.children.length === 0) {
      emptyMessage.classList.remove('hidden');
    } else {
      emptyMessage.classList.add('hidden');
    }
    return;
  }

  emptyMessage.classList.add('hidden');

  promptsToDisplay.forEach((prompt) => {
    const item = document.createElement('li');
    item.className = `prompt-card ${prompt.isPinned ? 'pinned-card' : ''}`;
    item.dataset.id = prompt.id;

    const header = document.createElement('header');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'flex-start';
    header.style.gap = '0.75rem';

    const leftSide = document.createElement('div');
    leftSide.style.display = 'flex';
    leftSide.style.flexDirection = 'column';
    leftSide.style.gap = '0.35rem';

    const titleRow = document.createElement('div');
    titleRow.className = 'prompt-title-row';

    const title = document.createElement('h3');
    title.className = 'prompt-title';
    title.textContent = (prompt.isPinned ? '⭐ ' : '') + (prompt.title || 'Untitled Prompt');

    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.textContent = getCategoryName(prompt);

    titleRow.append(title, badge);

    const meta = document.createElement('span');
    meta.className = 'prompt-meta';
    meta.textContent = prompt.createdAt ? new Date(prompt.createdAt).toLocaleString() : 'Just now';

    leftSide.append(titleRow, meta);
    header.appendChild(leftSide);

    // Right-side Folder action button
    const rightSide = document.createElement('div');
    rightSide.className = 'prompt-right-side';
    rightSide.style.display = 'flex';
    rightSide.style.alignItems = 'center';
    rightSide.style.gap = '0.5rem';

    const folderBtn = document.createElement('button');
    folderBtn.type = 'button';
    folderBtn.className = 'prompt-folder-btn';
    folderBtn.style.display = 'inline-flex';
    folderBtn.style.alignItems = 'center';
    folderBtn.style.gap = '6px';
    if (prompt.folder) {
      folderBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg><span class="folder-name-text">${prompt.folder}</span>`;
      folderBtn.title = `Change folder (currently in: ${prompt.folder})`;
      folderBtn.classList.add('in-folder');
    } else {
      folderBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg><span class="folder-name-text">Move to Folder</span>`;
      folderBtn.title = "Assign this prompt to a folder";
    }

    folderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMoveToFolderModal(prompt.id);
    });

    rightSide.appendChild(folderBtn);
    header.appendChild(rightSide);

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

// ============= FOLDERS MANAGEMENT & INTERACTIONS =============

function showCustomInput(title, message, placeholder = '') {
  return new Promise((resolve) => {
    inputModalTitle.textContent = title;
    inputModalMessage.textContent = message;
    customModalInput.value = '';
    customModalInput.placeholder = placeholder;

    const cleanup = (value) => {
      inputModalOverlay.classList.add('hidden');
      inputModalCancelBtn.removeEventListener('click', onCancel);
      inputModalSubmitBtn.removeEventListener('click', onSubmit);
      inputModalCloseBtn.removeEventListener('click', onCancel);
      inputModalOverlay.removeEventListener('click', onOverlayClick);
      resolve(value);
    };

    const onCancel = () => cleanup(null);
    const onSubmit = () => {
      const val = customModalInput.value.trim();
      cleanup(val);
    };
    const onOverlayClick = (e) => {
      if (e.target === inputModalOverlay) cleanup(null);
    };

    inputModalCancelBtn.addEventListener('click', onCancel);
    inputModalSubmitBtn.addEventListener('click', onSubmit);
    inputModalCloseBtn.addEventListener('click', onCancel);
    inputModalOverlay.addEventListener('click', onOverlayClick);

    inputModalOverlay.classList.remove('hidden');
    customModalInput.focus();
  });
}

async function movePromptToFolder(promptId, folderName) {
  const prompt = prompts.find(p => p.id === promptId);
  if (!prompt) return;

  prompt.folder = folderName;

  // Save to server
  const updatedPrompts = await savePromptToServer(prompt);
  if (updatedPrompts) {
    prompts = updatedPrompts.map(item => ({
      ...item,
      isPinned: item.id === prompt.id ? prompt.isPinned : (item.isPinned || false)
    }));
    render();
    showStatus(folderName ? `Moved to folder "${folderName}"` : 'Removed from folder');
  }
}

async function openMoveToFolderModal(promptId) {
  const prompt = prompts.find(p => p.id === promptId);
  if (!prompt) return;

  folderModalPromptTitle.textContent = `Prompt: "${prompt.title || 'Untitled'}"`;
  newFolderInput.value = '';

  // Render existing folders list
  const folders = getFolders();
  existingFoldersList.innerHTML = '';

  if (folders.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.style.color = 'var(--muted)';
    emptyLi.style.fontSize = '0.9rem';
    emptyLi.style.textAlign = 'center';
    emptyLi.style.padding = '0.5rem';
    emptyLi.textContent = 'No folders created yet';
    existingFoldersList.appendChild(emptyLi);
  } else {
    folders.forEach(f => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `folder-select-item ${prompt.folder === f ? 'active' : ''}`;
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'space-between';
      btn.innerHTML = `<span style="display: flex; align-items: center; gap: 6px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg><span>${f}</span></span> ${prompt.folder === f ? '<span>✓ Selected</span>' : ''}`;
      btn.addEventListener('click', async () => {
        await movePromptToFolder(promptId, f);
        folderModalOverlay.classList.add('hidden');
      });
      li.appendChild(btn);
      existingFoldersList.appendChild(li);
    });
  }

  const onCreate = async () => {
    const newName = newFolderInput.value.trim();
    if (!newName) {
      newFolderInput.focus();
      return;
    }
    if (!customFolders.includes(newName)) {
      customFolders.push(newName);
      saveCustomFolders();
    }
    await movePromptToFolder(promptId, newName);
    folderModalOverlay.classList.add('hidden');
  };

  const onRemove = async () => {
    await movePromptToFolder(promptId, '');
    folderModalOverlay.classList.add('hidden');
  };

  const onCancel = () => {
    folderModalOverlay.classList.add('hidden');
  };

  const newCreateBtn = createFolderBtn.cloneNode(true);
  createFolderBtn.replaceWith(newCreateBtn);
  newCreateBtn.addEventListener('click', onCreate);

  const newRemoveBtn = folderModalRemoveBtn.cloneNode(true);
  folderModalRemoveBtn.replaceWith(newRemoveBtn);
  if (prompt.folder) {
    newRemoveBtn.classList.remove('hidden');
    newRemoveBtn.addEventListener('click', onRemove);
  } else {
    newRemoveBtn.classList.add('hidden');
  }

  const newCancelBtn = folderModalCancelBtn.cloneNode(true);
  folderModalCancelBtn.replaceWith(newCancelBtn);
  newCancelBtn.addEventListener('click', onCancel);

  const newCloseBtn = folderModalCloseBtn.cloneNode(true);
  folderModalCloseBtn.replaceWith(newCloseBtn);
  newCloseBtn.addEventListener('click', onCancel);

  createFolderBtn = newCreateBtn;
  folderModalRemoveBtn = newRemoveBtn;
  folderModalCancelBtn = newCancelBtn;
  folderModalCloseBtn = newCloseBtn;

  folderModalOverlay.classList.remove('hidden');
}

async function showFolderActionConfirm(folderName) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const footerEl = overlay.querySelector('.modal-footer');
    const closeBtn = document.getElementById('confirm-modal-close-btn');

    titleEl.textContent = `Folder: "${folderName}"`;
    messageEl.textContent = `Do you want to Rename or Delete this folder?`;

    // Save original footer content to restore later
    const originalFooterHTML = footerEl.innerHTML;

    // Create three buttons: Cancel, Delete Folder, Rename
    footerEl.innerHTML = `
      <button type="button" id="folder-action-cancel" class="ghost-btn">Cancel</button>
      <button type="button" id="folder-action-delete" class="delete-btn" style="background: rgba(255, 107, 107, 0.15); color: var(--danger); border: 1px solid rgba(255, 107, 107, 0.3);">Delete Folder</button>
      <button type="button" id="folder-action-rename" class="copy-btn">Rename</button>
    `;

    const cancelBtn = document.getElementById('folder-action-cancel');
    const deleteBtn = document.getElementById('folder-action-delete');
    const renameBtn = document.getElementById('folder-action-rename');

    const cleanup = (value) => {
      overlay.classList.add('hidden');
      footerEl.innerHTML = originalFooterHTML;
      
      closeBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      resolve(value);
    };

    const onCancel = () => cleanup(null);
    const onDelete = () => cleanup('delete');
    const onRename = () => cleanup('rename');
    const onOverlayClick = (e) => {
      if (e.target === overlay) cleanup(null);
    };

    cancelBtn.addEventListener('click', onCancel);
    deleteBtn.addEventListener('click', onDelete);
    renameBtn.addEventListener('click', onRename);
    closeBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);

    overlay.classList.remove('hidden');
  });
}

async function manageFolderOptions(folderName) {
  const choice = await showFolderActionConfirm(folderName);

  if (choice === 'rename') {
    const newName = await showCustomInput('Rename Folder', `Enter new name for folder "${folderName}":`, folderName);
    if (newName && newName !== folderName) {
      const idx = customFolders.indexOf(folderName);
      if (idx !== -1) {
        customFolders[idx] = newName;
      } else {
        customFolders.push(newName);
      }
      saveCustomFolders();

      for (const p of prompts) {
        if (p.folder === folderName) {
          p.folder = newName;
          await savePromptToServer(p);
        }
      }

      if (activeFolder === folderName) {
        activeFolder = newName;
      }

      render();
      showStatus(`Folder renamed to "${newName}"`);
    }
  } else if (choice === 'delete') {
    const confirmDelete = await showCustomConfirm(
      'Delete Folder',
      `Are you sure you want to delete folder "${folderName}"? Prompts inside will be kept but removed from this folder.`,
      'Delete Folder',
      'delete-btn'
    );

    if (confirmDelete) {
      const idx = customFolders.indexOf(folderName);
      if (idx !== -1) {
        customFolders.splice(idx, 1);
        saveCustomFolders();
      }

      for (const p of prompts) {
        if (p.folder === folderName) {
          p.folder = '';
          await savePromptToServer(p);
        }
      }

      if (activeFolder === folderName) {
        activeFolder = 'all';
      }

      render();
      showStatus(`Folder "${folderName}" deleted`);
    }
  }
}

function renderFolders() {
  const folders = getFolders();
  folderList.innerHTML = '';

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = `category-pill ${activeFolder === 'all' ? 'active' : ''}`;
  allButton.innerHTML = '<span>All folders</span><strong>' + prompts.length + '</strong>';
  allButton.addEventListener('click', () => {
    activeFolder = 'all';
    render();
  });
  folderList.appendChild(allButton);

  folders.forEach((folder) => {
    const count = prompts.filter((prompt) => (prompt.folder || '') === folder).length;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-pill-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.width = '100%';
    wrapper.style.gap = '0.25rem';
    wrapper.style.alignItems = 'center';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-pill ${activeFolder === folder ? 'active' : ''}`;
    button.style.flex = '1';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'space-between';
    button.innerHTML = `<span style="display: flex; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; margin-right: 0.35rem; color: var(--accent);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>${folder}</span><strong>${count}</strong>`;
    button.addEventListener('click', () => {
      activeFolder = folder;
      render();
    });
    wrapper.appendChild(button);

    const optionsBtn = document.createElement('button');
    optionsBtn.type = 'button';
    optionsBtn.className = 'ghost-btn';
    optionsBtn.style.padding = '0.35rem';
    optionsBtn.style.fontSize = '0.9rem';
    optionsBtn.style.display = 'inline-flex';
    optionsBtn.style.alignItems = 'center';
    optionsBtn.style.justifyContent = 'center';
    optionsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
    optionsBtn.title = 'Manage folder';
    optionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      manageFolderOptions(folder);
    });
    wrapper.appendChild(optionsBtn);

    folderList.appendChild(wrapper);
  });
}

function renderUserProfile() {
  if (currentUser) {
    userProfileCard.classList.remove('hidden');
    userNameMini.textContent = currentUser.name || 'User';
    userEmailMini.textContent = currentUser.email || '';
    userAvatarMini.src = currentUser.picture || getGoogleAvatarUrl(currentUser.name);
    setupPremiumBackupUI(); 
  }
}

function render() {
  populateCategorySelect();
  renderSidebar();
  renderFolders();
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
  activeFolder = 'all';
  customFolders = [];
  saveCustomFolders();
  
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
  const textSpan = compactModeToggleBtn.querySelector('span');
  if (textSpan) {
    textSpan.textContent = isCompact ? 'Exit Compact' : 'Compact';
  }
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
clearFolderFilterButton.addEventListener('click', () => {
  activeFolder = 'all';
  render();
});
sidebarAddFolderBtn.addEventListener('click', async () => {
  const newName = await showCustomInput('New Folder', 'Enter folder name:');
  if (newName) {
    if (!customFolders.includes(newName)) {
      customFolders.push(newName);
      saveCustomFolders();
      render();
      showStatus(`Folder "${newName}" created`);
    } else {
      showStatus('Folder already exists');
    }
  }
});
signOutButton.addEventListener('click', signOut);

// Initialize App
async function initializeApp() {
  loadCustomFolders();
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