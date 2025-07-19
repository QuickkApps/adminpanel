console.log('🚀 Admin Panel JavaScript v5.0 loaded successfully! Modern UI with tabs and user management!');
console.log('📋 Available functions: Tab navigation, user management, online tracking, admin accounts');
console.log('🔧 If buttons still don\'t work, try hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)');
console.log('⏰ Loaded at:', new Date().toLocaleTimeString());

// Global variables for user management
let currentUsers = [];
let filteredUsers = [];
let onlineUsers = [];
let adminUsers = [];
let currentTab = 'dashboard';
let currentPage = 1;
let totalPages = 1;
let usersPerPage = 20;
let sortField = 'username';
let sortDirection = 'asc';
let selectedUsers = new Set();

// Test function to verify JavaScript is working
window.testJS = function() {
    alert('✅ JavaScript v5.0 is working! Modern UI with tabs and user management.');
    console.log('✅ JavaScript test successful');
};

// Tab Management Functions
window.showTab = function(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.add('hidden'));

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected tab content
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }

    // Add active class to selected tab
    const activeTab = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    currentTab = tabName;

    // Load data for specific tabs
    switch(tabName) {
        case 'users':
            refreshUserList();
            break;
        case 'online':
            refreshOnlineUsers();
            break;
        case 'admins':
            refreshAdminList();
            break;
        case 'dashboard':
            updateDashboardStats();
            break;
    }
};

// Modal Management Functions
window.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
};

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('adminToken');
    const sessionToken = localStorage.getItem('sessionToken');

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': sessionToken
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    const response = await fetch(endpoint, finalOptions);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'API call failed');
    }

    return data;
}

// User Management Functions
window.refreshUserList = async function(page = 1) {
    console.log('🔄 Refreshing user list...');
    const tbody = document.getElementById('userTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading users...
                </td>
            </tr>
        `;
    }

    try {
        // Get current filters
        const search = document.getElementById('userSearch')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const subscription = document.getElementById('subscriptionFilter')?.value || '';

        const params = new URLSearchParams({
            page: page.toString(),
            limit: usersPerPage.toString()
        });

        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (subscription) params.append('subscriptionType', subscription);

        const response = await apiCall(`/api/users?${params.toString()}`);

        // Store data globally
        currentUsers = response.data.users;
        filteredUsers = [...currentUsers];
        currentPage = response.data.page;
        totalPages = response.data.totalPages;

        displayUsers(filteredUsers);
        updatePagination(response.data);
        updateUserCount(response.data.total, filteredUsers.length);

        // Update total users count in dashboard
        document.getElementById('totalUsers').textContent = response.data.total;

        // Clear selections
        selectedUsers.clear();
        updateBulkActions();

    } catch (error) {
        console.error('Error loading users:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--error-color);">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                        Error loading users: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
};

window.refreshOnlineUsers = async function() {
    console.log('🔄 Refreshing online users...');
    const container = document.getElementById('onlineUsersList');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 16px;"></i>
                <p>Loading online users...</p>
            </div>
        `;
    }

    try {
        // Try WebSocket first for real-time data
        if (window.adminPanel && window.adminPanel.socket && window.adminPanel.socket.connected) {
            window.adminPanel.socket.emit('get-online-users', (response) => {
                if (response.success) {
                    displayOnlineUsers(response.users);
                    updateOnlineCount(response.users.length);
                } else {
                    throw new Error(response.message);
                }
            });
        } else {
            // Fallback to REST API
            const response = await apiCall('/api/users/online');
            displayOnlineUsers(response.data);
            updateOnlineCount(response.count);
        }
    } catch (error) {
        console.error('Error loading online users:', error);
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 16px;"></i>
                    <p>Error loading online users: ${error.message}</p>
                </div>
            `;
        }
    }
};

window.refreshAdminList = async function() {
    console.log('🔄 Refreshing admin list...');
    const tbody = document.getElementById('adminTableBody');

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading admins...
                </td>
            </tr>
        `;
    }

    try {
        const response = await apiCall('/api/admins');
        displayAdmins(response.data);
    } catch (error) {
        console.error('Error loading admins:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--error-color);">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                        Error loading admins: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
};

window.updateDashboardStats = async function() {
    console.log('📊 Updating dashboard stats...');

    try {
        // Load user stats
        const userStatsResponse = await apiCall('/api/users/stats');
        const userStats = userStatsResponse.data;

        // Load admin stats
        const adminStatsResponse = await apiCall('/api/admins/stats');
        const adminStats = adminStatsResponse.data;

        // Update dashboard
        document.getElementById('totalUsers').textContent = userStats.total || '0';
        document.getElementById('onlineUsers').textContent = userStats.online || '0';
        document.getElementById('adminCount').textContent = adminStats.active || '0';
        document.getElementById('serverStatus').textContent = 'Online';
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
        // Set default values on error
        document.getElementById('totalUsers').textContent = '0';
        document.getElementById('onlineUsers').textContent = '0';
        document.getElementById('adminCount').textContent = '1';
        document.getElementById('serverStatus').textContent = 'Error';
    }
};

// Enhanced Notification System
window.showAlert = function(message, type = 'info', duration = 5000) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.cssText = `
        margin-bottom: 12px;
        pointer-events: auto;
        transform: translateX(100%);
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
        padding-right: 40px;
    `;

    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
        <button style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: inherit; cursor: pointer; font-size: 16px;" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add to container
    notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove
    const removeNotification = () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };

    // Click to dismiss
    notification.addEventListener('click', removeNotification);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(removeNotification, duration);
    }

    return notification;
};

// Update version indicator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const versionEl = document.getElementById('jsVersion');
    if (versionEl) {
        versionEl.textContent = 'JS: v5.0 ✅';
        versionEl.style.color = '#10b981';
    }

    // Initialize default tab
    showTab('dashboard');

    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add loading states to buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn') && !e.target.disabled) {
            const originalText = e.target.innerHTML;
            const hasIcon = originalText.includes('<i class="fas');

            // Add loading state for async operations
            if (e.target.onclick && e.target.onclick.toString().includes('async')) {
                e.target.innerHTML = hasIcon ?
                    '<i class="fas fa-spinner fa-spin"></i> Loading...' :
                    'Loading...';
                e.target.disabled = true;

                // Reset after 3 seconds (fallback)
                setTimeout(() => {
                    e.target.innerHTML = originalText;
                    e.target.disabled = false;
                }, 3000);
            }
        }
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('userSearch');
            if (searchInput && !searchInput.classList.contains('hidden')) {
                searchInput.focus();
            }
        }

        // Ctrl/Cmd + R to refresh current tab
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && currentTab !== 'dashboard') {
            e.preventDefault();
            switch(currentTab) {
                case 'users':
                    refreshUserList();
                    break;
                case 'online':
                    refreshOnlineUsers();
                    break;
                case 'admins':
                    refreshAdminList();
                    break;
            }
        }
    });

    // Add tooltips to buttons
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.position = 'relative';
        });
    });
});

// Helper Functions
function displayUsers(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted);">
                    <i class="fas fa-users" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No users found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        const serverUrl = user.server_url || user.server || 'Unknown';
        const subscriptionType = user.subscription_type || user.subscription || 'Basic';
        const subscriptionStatus = user.subscription_status || user.status || 'active';
        const isOnline = user.is_online || false;

        return `
            <tr>
                <td>
                    <input type="checkbox" class="user-checkbox" value="${user.id}" onchange="toggleUserSelection(${user.id})">
                </td>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h4>${user.username}</h4>
                            <p>ID: ${user.id}</p>
                            ${isOnline ? '<p style="color: var(--success-color);"><i class="fas fa-circle" style="font-size: 8px; margin-right: 4px;"></i>Online</p>' : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-size: 14px;">${serverUrl}</span>
                </td>
                <td>
                    <span class="user-status ${subscriptionStatus === 'active' ? 'online' : 'offline'}">
                        ${subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                    </span>
                </td>
                <td>${lastLogin}</td>
                <td>
                    <span class="user-status ${subscriptionType === 'premium' ? 'online' : subscriptionType === 'trial' ? 'offline' : 'online'}" style="background: ${subscriptionType === 'premium' ? 'rgba(16, 185, 129, 0.1)' : subscriptionType === 'trial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(148, 163, 184, 0.1)'};">
                        ${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm" onclick="viewUserDetails('${user.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="toggleUserStatus(${user.id}, ${!user.is_active})" title="${user.is_active ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                        </button>
                        ${isOnline ? `
                            <button class="btn btn-danger btn-sm" onclick="disconnectUser('${user.id}')" title="Disconnect">
                                <i class="fas fa-sign-out-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function displayOnlineUsers(users) {
    const container = document.getElementById('onlineUsersList');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-user-slash" style="font-size: 24px; margin-bottom: 16px;"></i>
                <p>No users currently online</p>
            </div>
        `;
        return;
    }

    container.innerHTML = users.map(user => {
        const connectedTime = user.connectedAt ? new Date(user.connectedAt).toLocaleString() : 'Unknown';
        const serverUrl = user.serverUrl || user.server_url || 'Unknown';
        const ipAddress = user.ipAddress || user.last_ip || 'Unknown';
        const appVersion = user.appVersion || user.app_version || 'Unknown';

        return `
            <div class="user-card">
                <div class="user-header">
                    <div class="user-info">
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <h4>${user.username}</h4>
                            <p><i class="fas fa-server" style="margin-right: 4px;"></i> ${serverUrl}</p>
                            <p><i class="fas fa-clock" style="margin-right: 4px;"></i> Connected: ${connectedTime}</p>
                            <p><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i> IP: ${ipAddress}</p>
                            ${appVersion !== 'Unknown' ? `<p><i class="fas fa-mobile-alt" style="margin-right: 4px;"></i> App: ${appVersion}</p>` : ''}
                        </div>
                    </div>
                    <span class="user-status online">
                        <div class="status-dot"></div>
                        Online
                    </span>
                </div>
                <div class="user-actions">
                    <button class="btn btn-primary btn-sm" onclick="viewUserDetails('${user.userId || user.id}')">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="disconnectUser('${user.userId || user.id}')">
                        <i class="fas fa-sign-out-alt"></i>
                        Disconnect
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateOnlineCount(count) {
    const onlineCountEl = document.getElementById('onlineCount');
    if (onlineCountEl) {
        onlineCountEl.textContent = count;
    }

    const onlineUsersEl = document.getElementById('onlineUsers');
    if (onlineUsersEl) {
        onlineUsersEl.textContent = count;
    }
}

function displayAdmins(admins) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (admins.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted);">
                    <i class="fas fa-user-shield" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No admins found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = admins.map(admin => `
        <tr>
            <td>${admin.username}</td>
            <td>
                <span class="user-status ${admin.role === 'super_admin' ? 'online' : 'offline'}">
                    ${admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
            </td>
            <td>${admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'Unknown'}</td>
            <td>${admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}</td>
            <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <button class="btn btn-warning btn-sm" onclick="window.changeAdminPassword('${admin.username}')" title="Change Password">
                        <i class="fas fa-key"></i>
                    </button>
                    ${admin.role !== 'super_admin' ? `
                        <button class="btn btn-danger btn-sm" onclick="window.deactivateAdmin(${admin.id})" title="Deactivate">
                            <i class="fas fa-ban"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteAdmin(${admin.id}, '${admin.username}')" title="Delete Admin" style="background: #dc2626;">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}

                    <!-- Debug info -->
                    <button class="btn btn-info btn-sm" onclick="console.log('Admin data:', ${JSON.stringify(admin).replace(/'/g, '\\\'')}, 'Delete function:', typeof window.deleteAdmin); alert('Check console for admin data');" title="Debug" style="font-size: 10px;">
                        🔧
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Admin Management Functions
window.showAddAdminModal = function() {
    showModal('addAdminModal');
};

window.createAdmin = async function() {
    const form = document.getElementById('addAdminForm');
    const formData = new FormData(form);

    const adminData = {
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role')
    };

    // Basic validation
    if (!adminData.username || adminData.username.length < 3) {
        alert('Username must be at least 3 characters long');
        return;
    }

    if (!adminData.password || adminData.password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(adminData.password)) {
        alert('Password must contain at least one lowercase letter, one uppercase letter, and one number');
        return;
    }

    console.log('Creating admin:', adminData);

    try {
        const response = await apiCall('/api/admins', {
            method: 'POST',
            body: JSON.stringify(adminData)
        });

        showAlert('Admin created successfully!', 'success');
        closeModal('addAdminModal');
        form.reset();

        // Refresh admin list if we're on the admins tab
        if (currentTab === 'admins') {
            refreshAdminList();
        }

        // Update dashboard stats
        updateDashboardStats();
    } catch (error) {
        console.error('Error creating admin:', error);
        showAlert(`Failed to create admin: ${error.message}`, 'error');
    }
};

window.changeAdminPassword = function(username) {
    showModal('changePasswordModal');
    // Store the username for the password change
    document.getElementById('changePasswordModal').dataset.username = username;
};

window.updatePassword = async function() {
    const modal = document.getElementById('changePasswordModal');
    const username = modal.dataset.username;

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    console.log('Updating password for:', username);

    try {
        const response = await apiCall('/api/admins/password', {
            method: 'PATCH',
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });

        alert('Password updated successfully!');
        closeModal('changePasswordModal');

        // Clear form
        document.getElementById('changePasswordForm').reset();
    } catch (error) {
        console.error('Error updating password:', error);
        alert(`Failed to update password: ${error.message}`);
    }
};

// User Action Functions
window.viewUserDetails = async function(userId) {
    console.log('Viewing details for user:', userId);

    try {
        const response = await apiCall(`/api/users/${userId}`);
        const user = response.data;

        const userDetailsContent = document.getElementById('userDetailsContent');
        if (userDetailsContent) {
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
            const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown';
            const activeSessions = user.sessions ? user.sessions.filter(s => s.status === 'active').length : 0;
            const totalSessions = user.sessions ? user.sessions.length : 0;

            userDetailsContent.innerHTML = `
                <div class="user-info" style="margin-bottom: 20px; display: flex; align-items: center; gap: 16px;">
                    <div class="user-avatar" style="width: 60px; height: 60px; font-size: 24px;">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <h3 style="margin: 0; color: var(--text-primary);">${user.username}</h3>
                        <p style="margin: 4px 0; color: var(--text-secondary);">User ID: ${user.id}</p>
                        <p style="margin: 4px 0; color: var(--text-secondary);">Server: ${user.server_url}</p>
                        <span class="user-status ${user.is_online ? 'online' : 'offline'}" style="margin-top: 8px;">
                            ${user.is_online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>

                <div class="stats-grid" style="margin-bottom: 24px;">
                    <div class="stat-card">
                        <div class="stat-value" style="color: ${user.subscription_status === 'active' ? 'var(--success-color)' : 'var(--error-color)'};">
                            ${user.subscription_status ? user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1) : 'Unknown'}
                        </div>
                        <div class="stat-label">Account Status</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--primary-color);">
                            ${user.subscription_type ? user.subscription_type.charAt(0).toUpperCase() + user.subscription_type.slice(1) : 'Basic'}
                        </div>
                        <div class="stat-label">Subscription</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${activeSessions}</div>
                        <div class="stat-label">Active Sessions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${user.total_connections || 0}</div>
                        <div class="stat-label">Total Connections</div>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="color: var(--text-primary); margin-bottom: 12px;">Account Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div>
                            <strong>Last Login:</strong><br>
                            <span style="color: var(--text-secondary);">${lastLogin}</span>
                        </div>
                        <div>
                            <strong>Created:</strong><br>
                            <span style="color: var(--text-secondary);">${createdAt}</span>
                        </div>
                        <div>
                            <strong>Last IP:</strong><br>
                            <span style="color: var(--text-secondary);">${user.last_ip || 'Unknown'}</span>
                        </div>
                        <div>
                            <strong>App Version:</strong><br>
                            <span style="color: var(--text-secondary);">${user.app_version || 'Unknown'}</span>
                        </div>
                        ${user.expiry_date ? `
                        <div>
                            <strong>Subscription Expires:</strong><br>
                            <span style="color: var(--text-secondary);">${new Date(user.expiry_date).toLocaleDateString()}</span>
                        </div>
                        ` : ''}
                        <div>
                            <strong>Max Connections:</strong><br>
                            <span style="color: var(--text-secondary);">${user.max_connections || 1}</span>
                        </div>
                    </div>
                </div>

                ${user.sessions && user.sessions.length > 0 ? `
                <div>
                    <h4 style="color: var(--text-primary); margin-bottom: 12px;">Recent Sessions</h4>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${user.sessions.map(session => `
                            <div class="user-card" style="margin-bottom: 12px; padding: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${session.connection_type || 'Unknown'}</strong>
                                        <span class="user-status ${session.status === 'active' ? 'online' : 'offline'}" style="margin-left: 8px;">
                                            ${session.status}
                                        </span>
                                    </div>
                                    <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
                                        <div>Started: ${new Date(session.started_at).toLocaleString()}</div>
                                        ${session.ended_at ? `<div>Ended: ${new Date(session.ended_at).toLocaleString()}</div>` : ''}
                                        <div>Duration: ${Math.floor(session.duration_seconds / 60)} minutes</div>
                                    </div>
                                </div>
                                ${session.ip_address ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">IP: ${session.ip_address}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            `;
        }

        showModal('userDetailsModal');
    } catch (error) {
        console.error('Error loading user details:', error);
        showAlert(`Failed to load user details: ${error.message}`, 'error');
    }
};

window.editUser = function(username) {
    console.log('Editing user:', username);
    alert('User editing functionality will be implemented with backend API');
};

// Pagination Functions
window.changePage = function(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        refreshUserList(newPage);
    }
};

function updatePagination(data) {
    const paginationInfo = document.getElementById('userPaginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (paginationInfo) {
        const start = (data.page - 1) * usersPerPage + 1;
        const end = Math.min(data.page * usersPerPage, data.total);
        paginationInfo.textContent = `Showing ${start}-${end} of ${data.total} users`;
    }

    if (prevBtn) {
        prevBtn.disabled = !data.hasPrev;
    }

    if (nextBtn) {
        nextBtn.disabled = !data.hasNext;
    }
}

function updateUserCount(total, filtered) {
    const userCount = document.getElementById('userCount');
    if (userCount) {
        if (filtered < total) {
            userCount.textContent = `Showing ${filtered} of ${total} users`;
        } else {
            userCount.textContent = `${total} users total`;
        }
    }
}

// Filtering Functions
window.filterUsers = function() {
    const search = document.getElementById('userSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const subscription = document.getElementById('subscriptionFilter').value;

    // If filters changed, refresh from server
    refreshUserList(1);
};

window.clearFilters = function() {
    document.getElementById('userSearch').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('subscriptionFilter').value = '';
    refreshUserList(1);
};

// Sorting Functions
window.sortUsers = function(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    // Sort current users array
    filteredUsers.sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';

        // Handle dates
        if (field === 'last_login') {
            aVal = new Date(aVal || 0);
            bVal = new Date(bVal || 0);
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    displayUsers(filteredUsers);
    updateSortIcons();
};

function updateSortIcons() {
    // Reset all sort icons
    document.querySelectorAll('th i.fas').forEach(icon => {
        if (icon.classList.contains('fa-sort') || icon.classList.contains('fa-sort-up') || icon.classList.contains('fa-sort-down')) {
            icon.className = 'fas fa-sort';
        }
    });

    // Update current sort field icon
    const currentHeader = document.querySelector(`th[onclick="sortUsers('${sortField}')"] i`);
    if (currentHeader) {
        currentHeader.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
    }
}

// Selection Functions
window.toggleSelectAll = function() {
    const selectAll = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('.user-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        const userId = parseInt(checkbox.value);
        if (selectAll.checked) {
            selectedUsers.add(userId);
        } else {
            selectedUsers.delete(userId);
        }
    });

    updateBulkActions();
};

window.toggleUserSelection = function(userId) {
    if (selectedUsers.has(userId)) {
        selectedUsers.delete(userId);
    } else {
        selectedUsers.add(userId);
    }

    updateBulkActions();
    updateSelectAllState();
};

function updateSelectAllState() {
    const selectAll = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');

    if (checkedBoxes.length === 0) {
        selectAll.indeterminate = false;
        selectAll.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAll.indeterminate = false;
        selectAll.checked = true;
    } else {
        selectAll.indeterminate = true;
        selectAll.checked = false;
    }
}

function updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');

    if (selectedUsers.size > 0) {
        bulkActions.style.display = 'block';
        selectedCount.textContent = `${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''} selected`;
    } else {
        bulkActions.style.display = 'none';
    }
}

// Bulk Operations
window.bulkActivateUsers = async function() {
    if (selectedUsers.size === 0) return;

    if (!confirm(`Are you sure you want to activate ${selectedUsers.size} selected user${selectedUsers.size > 1 ? 's' : ''}?`)) {
        return;
    }

    try {
        const promises = Array.from(selectedUsers).map(userId =>
            apiCall(`/api/users/${userId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                    isActive: true,
                    reason: 'bulk_activation'
                })
            })
        );

        await Promise.all(promises);
        showAlert(`Successfully activated ${selectedUsers.size} users`, 'success');

        selectedUsers.clear();
        refreshUserList(currentPage);
    } catch (error) {
        console.error('Error activating users:', error);
        showAlert(`Failed to activate users: ${error.message}`, 'error');
    }
};

window.bulkDeactivateUsers = async function() {
    if (selectedUsers.size === 0) return;

    if (!confirm(`Are you sure you want to deactivate ${selectedUsers.size} selected user${selectedUsers.size > 1 ? 's' : ''}?`)) {
        return;
    }

    try {
        const promises = Array.from(selectedUsers).map(userId =>
            apiCall(`/api/users/${userId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                    isActive: false,
                    reason: 'bulk_deactivation'
                })
            })
        );

        await Promise.all(promises);
        showAlert(`Successfully deactivated ${selectedUsers.size} users`, 'success');

        selectedUsers.clear();
        refreshUserList(currentPage);
    } catch (error) {
        console.error('Error deactivating users:', error);
        showAlert(`Failed to deactivate users: ${error.message}`, 'error');
    }
};

window.bulkDisconnectUsers = async function() {
    if (selectedUsers.size === 0) return;

    if (!confirm(`Are you sure you want to disconnect ${selectedUsers.size} selected user${selectedUsers.size > 1 ? 's' : ''}?`)) {
        return;
    }

    try {
        const promises = Array.from(selectedUsers).map(userId =>
            apiCall(`/api/users/${userId}/disconnect`, {
                method: 'POST',
                body: JSON.stringify({
                    reason: 'bulk_disconnect'
                })
            })
        );

        await Promise.all(promises);
        showAlert(`Successfully disconnected ${selectedUsers.size} users`, 'success');

        selectedUsers.clear();
        refreshUserList(currentPage);
    } catch (error) {
        console.error('Error disconnecting users:', error);
        showAlert(`Failed to disconnect users: ${error.message}`, 'error');
    }
};

// Toggle user status function
window.toggleUserStatus = async function(userId, activate) {
    try {
        const response = await apiCall(`/api/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                isActive: activate,
                reason: activate ? 'admin_activation' : 'admin_deactivation'
            })
        });

        showAlert(`User ${activate ? 'activated' : 'deactivated'} successfully`, 'success');
        refreshUserList(currentPage);
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert(`Failed to ${activate ? 'activate' : 'deactivate'} user: ${error.message}`, 'error');
    }
};

// Export functionality
window.exportUserList = async function() {
    try {
        const response = await apiCall('/api/users?limit=1000'); // Get all users for export
        const users = response.data.users;

        // Create CSV content
        const headers = ['ID', 'Username', 'Server URL', 'Status', 'Subscription Type', 'Last Login', 'Created At', 'Is Online'];
        const csvContent = [
            headers.join(','),
            ...users.map(user => [
                user.id,
                user.username,
                user.server_url || '',
                user.subscription_status || '',
                user.subscription_type || '',
                user.last_login || '',
                user.created_at || '',
                user.is_online ? 'Yes' : 'No'
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showAlert('User list exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting users:', error);
        showAlert(`Failed to export users: ${error.message}`, 'error');
    }
};

// Admin Management Functions
window.deactivateAdmin = async function(adminId) {
    if (confirm('Are you sure you want to deactivate this admin account?')) {
        try {
            const response = await apiCall(`/api/admins/${adminId}/deactivate`, {
                method: 'PATCH'
            });

            showAlert('Admin account deactivated successfully!', 'success');
            refreshAdminList();
        } catch (error) {
            console.error('Error deactivating admin:', error);
            showAlert(`Failed to deactivate admin: ${error.message}`, 'error');
        }
    }
};

window.deleteAdmin = async function(adminId, username) {
    console.log('deleteAdmin called with:', adminId, username);

    // Double confirmation for delete action
    if (confirm(`Are you sure you want to DELETE admin account "${username}"?\n\nThis action cannot be undone!`)) {
        const confirmText = prompt(`This will permanently delete the admin account "${username}" and all associated data.\n\nType "DELETE" to confirm:`);
        if (confirmText === 'DELETE') {
            try {
                console.log('Attempting to delete admin:', adminId);
                const response = await apiCall(`/api/admins/${adminId}`, {
                    method: 'DELETE'
                });

                console.log('Delete response:', response);
                showAlert(`Admin account "${username}" deleted successfully!`, 'success');
                refreshAdminList();

                // Update dashboard stats
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                }
            } catch (error) {
                console.error('Error deleting admin:', error);
                showAlert(`Failed to delete admin: ${error.message}`, 'error');
            }
        } else if (confirmText !== null) {
            showAlert('Deletion cancelled - you must type "DELETE" exactly to confirm', 'warning');
        }
    }
};

// View admin profile
window.viewAdminProfile = async function() {
    try {
        const response = await apiCall('/api/admins/profile');
        const profile = response.data;

        const profileModal = document.createElement('div');
        profileModal.className = 'modal show';
        profileModal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-user-circle"></i>
                        Admin Profile
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${profile.username}</div>
                            <div class="stat-label">Username</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}</div>
                            <div class="stat-label">Role</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${profile.activeSessions || 0}</div>
                            <div class="stat-label">Active Sessions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'Never'}</div>
                            <div class="stat-label">Last Login</div>
                        </div>
                    </div>
                    <div style="margin-top: 20px;">
                        <h4 style="color: var(--text-primary); margin-bottom: 12px;">Account Information</h4>
                        <p><strong>Created:</strong> ${new Date(profile.created_at).toLocaleString()}</p>
                        <p><strong>Status:</strong> ${profile.is_active ? 'Active' : 'Inactive'}</p>
                        ${profile.email ? `<p><strong>Email:</strong> ${profile.email}</p>` : ''}
                        ${profile.full_name ? `<p><strong>Full Name:</strong> ${profile.full_name}</p>` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn btn-primary" onclick="changeAdminPassword('${profile.username}'); this.closest('.modal').remove();">
                        <i class="fas fa-key"></i>
                        Change Password
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(profileModal);
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error loading admin profile:', error);
        showAlert(`Failed to load profile: ${error.message}`, 'error');
    }
};

window.disconnectUser = async function(userId) {
    if (confirm(`Are you sure you want to disconnect this user?`)) {
        try {
            // Try WebSocket first for real-time disconnection
            if (window.adminPanel && window.adminPanel.socket && window.adminPanel.socket.connected) {
                window.adminPanel.socket.emit('admin-disconnect-user', {
                    userId: parseInt(userId),
                    reason: 'admin_disconnect'
                });
            } else {
                // Fallback to REST API
                const response = await apiCall(`/api/users/${userId}/disconnect`, {
                    method: 'POST',
                    body: JSON.stringify({
                        reason: 'admin_disconnect'
                    })
                });

                showAlert(`User disconnected successfully. ${response.data.disconnectedSessions} sessions ended.`, 'success');

                // Refresh the current view
                if (currentTab === 'users') {
                    refreshUserList();
                } else if (currentTab === 'online') {
                    refreshOnlineUsers();
                }
            }
        } catch (error) {
            console.error('Error disconnecting user:', error);
            showAlert(`Failed to disconnect user: ${error.message}`, 'error');
        }
    }
};

class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.socket = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeSocket();
        
        if (this.token) {
            this.verifyToken();
        } else {
            this.showLogin();
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Config form
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateConfig();
        });

        // Modal close on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
                document.body.style.overflow = 'auto';
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    openModal.classList.remove('show');
                    document.body.style.overflow = 'auto';
                }
            }
        });
    }

    initializeSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);

            // Authenticate admin socket if logged in
            if (this.token) {
                this.socket.emit('authenticate', {
                    token: this.token,
                    userType: 'admin'
                });
                this.socket.emit('subscribe-config-updates');
            }
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });

        this.socket.on('authenticated', (data) => {
            if (data.success) {
                console.log('Socket authenticated successfully');
            } else {
                console.warn('Socket authentication failed:', data.message);
            }
        });

        this.socket.on('config-updated', (config) => {
            this.showAlert('configAlert', 'Configuration updated remotely!', 'success');
            this.populateConfigForm(config);
            this.loadStatus();
        });

        this.socket.on('app-status-update', (status) => {
            this.updateAppStatus(status);
        });

        // Real-time user connection events
        this.socket.on('user-connected', (data) => {
            console.log('User connected:', data);
            showAlert(`User ${data.username} connected from ${data.serverUrl}`, 'info');

            // Refresh online users if on that tab
            if (currentTab === 'online') {
                refreshOnlineUsers();
            }

            // Update dashboard stats
            updateDashboardStats();
        });

        this.socket.on('user-disconnected', (data) => {
            console.log('User disconnected:', data);
            showAlert(`User ${data.username} disconnected`, 'info');

            // Refresh online users if on that tab
            if (currentTab === 'online') {
                refreshOnlineUsers();
            }

            // Update dashboard stats
            updateDashboardStats();
        });

        this.socket.on('user-disconnect-success', (data) => {
            showAlert(`User disconnected successfully`, 'success');

            // Refresh current view
            if (currentTab === 'users') {
                refreshUserList();
            } else if (currentTab === 'online') {
                refreshOnlineUsers();
            }
        });

        this.socket.on('user-disconnect-error', (data) => {
            showAlert(`Failed to disconnect user: ${data.message}`, 'error');
        });
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) return;

        const text = statusEl.querySelector('span:last-child');

        if (connected) {
            statusEl.className = 'status-indicator online';
            if (text) text.textContent = 'Connected';
        } else {
            statusEl.className = 'status-indicator offline';
            if (text) text.textContent = 'Disconnected';
        }
    }

    async login() {
        const form = document.getElementById('loginForm');
        const formData = new FormData(form);

        try {
            this.setLoading('loginForm', true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.token = data.token;
                localStorage.setItem('adminToken', this.token);
                localStorage.setItem('sessionToken', data.sessionToken);
                this.showAdmin();
                this.socket.emit('subscribe-config-updates');
                this.showAlert('loginAlert', 'Login successful!', 'success');
            } else {
                this.showAlert('loginAlert', data.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showAlert('loginAlert', 'Network error: ' + error.message, 'error');
        } finally {
            this.setLoading('loginForm', false);
        }
    }

    async verifyToken() {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showAdmin();
                this.socket.emit('subscribe-config-updates');
            } else {
                this.logout();
            }
        } catch (error) {
            this.logout();
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.populateConfigForm(data.config);
                this.showAlert('configAlert', 'Configuration loaded successfully!', 'success');
            } else {
                this.showAlert('configAlert', data.message || 'Failed to load configuration', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async updateConfig() {
        const form = document.getElementById('configForm');
        const formData = new FormData(form);
        
        try {
            this.setLoading('configForm', true);
            
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    apiUrl: formData.get('apiUrl'),
                    activationApiUrl: formData.get('activationApiUrl'),
                    isActive: formData.get('isActive') === 'true'
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('configAlert', 'Configuration updated successfully!', 'success');
                this.loadStatus();
            } else {
                this.showAlert('configAlert', data.message || 'Failed to update configuration', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        } finally {
            this.setLoading('configForm', false);
        }
    }

    async loadStatus() {
        try {
            const response = await fetch('/api/config/status', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.updateStatusDisplay(data.status);
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    async createBackup() {
        try {
            const response = await fetch('/api/config/backup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('configAlert', `Backup created: ${data.backupFileName}`, 'success');
                this.loadStatus();
                this.loadBackups(); // Refresh backup list
            } else {
                this.showAlert('configAlert', data.message || 'Failed to create backup', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async loadBackups() {
        try {
            const response = await fetch('/api/config/backups', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.displayBackups(data.backups);
                this.showAlert('backupAlert', `Found ${data.count} backup(s)`, 'success');
            } else {
                this.showAlert('backupAlert', data.message || 'Failed to load backups', 'error');
            }
        } catch (error) {
            this.showAlert('backupAlert', 'Network error: ' + error.message, 'error');
        }
    }

    displayBackups(backups) {
        const backupsList = document.getElementById('backupsList');

        if (backups.length === 0) {
            backupsList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No backups available</p>';
            return;
        }

        // Sort backups by timestamp (newest first)
        const sortedBackups = [...backups].sort((a, b) => {
            // Extract timestamp from filename - handle both old and new formats
            const extractTimestamp = (filename) => {
                // New format: database_backup_12am-23min-34sec_07-19-25.json
                const newMatch = filename.match(/database_backup_(\d+)(am|pm)-(\d+)min-(\d+)sec_(\d+)-(\d+)-(\d+)\.json$/);
                if (newMatch) {
                    const [, hour12, ampm, minutes, seconds, month, day, year] = newMatch;
                    let hour24 = parseInt(hour12);
                    if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
                    if (ampm === 'am' && hour24 === 12) hour24 = 0;

                    const fullYear = 2000 + parseInt(year);
                    return new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
                }

                // Old format: remote_config_backup_2025-07-18T19-31-00-922Z.json
                const oldMatch = filename.match(/remote_config_backup_(.+)\.json$/);
                if (oldMatch) {
                    const timestamp = oldMatch[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
                    return new Date(timestamp);
                }

                return new Date(0); // Fallback for invalid format
            };

            const dateA = extractTimestamp(a.filename);
            const dateB = extractTimestamp(b.filename);
            return dateB - dateA; // Newest first
        });

        let html = '<div style="max-height: 400px; overflow-y: auto;">';
        sortedBackups.forEach((backup, index) => {
            // Extract and format date from filename - handle both old and new formats
            const extractTimestamp = (filename) => {
                // New format: database_backup_12am-23min-34sec_07-19-25.json
                const newMatch = filename.match(/database_backup_(\d+)(am|pm)-(\d+)min-(\d+)sec_(\d+)-(\d+)-(\d+)\.json$/);
                if (newMatch) {
                    const [, hour12, ampm, minutes, seconds, month, day, year] = newMatch;
                    let hour24 = parseInt(hour12);
                    if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
                    if (ampm === 'am' && hour24 === 12) hour24 = 0;

                    const fullYear = 2000 + parseInt(year);
                    return new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
                }

                // Old format: remote_config_backup_2025-07-18T19-31-00-922Z.json
                const oldMatch = filename.match(/remote_config_backup_(.+)\.json$/);
                if (oldMatch) {
                    const timestamp = oldMatch[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
                    return new Date(timestamp);
                }

                return new Date();
            };

            const date = extractTimestamp(backup.filename).toLocaleString();
            const serialNumber = sortedBackups.length - index; // Serial number: oldest = 1, newest = highest number

            html += `
                <div class="backup-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div class="backup-info">
                            <div class="backup-filename">
                                <span style="color: #667eea; font-weight: bold; margin-right: 8px;">#${serialNumber}</span>
                                ${backup.filename}
                            </div>
                            <div class="backup-date">Created: ${date}</div>
                        </div>
                        <div class="backup-actions">
                            <button class="btn btn-primary btn-sm" onclick="restoreBackup('${backup.filename}')">
                                🔄 Restore
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="downloadBackup('${backup.filename}')">
                                💾 Download
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        backupsList.innerHTML = html;
    }

    async restoreBackup(backupFileName) {
        if (!confirm(`Are you sure you want to restore from backup: ${backupFileName}?\n\nThis will overwrite the current configuration.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/config/restore/${backupFileName}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('backupAlert', `Configuration restored from: ${backupFileName}`, 'success');
                this.loadConfig(); // Reload current config
                this.loadStatus(); // Reload status
            } else {
                this.showAlert('backupAlert', data.message || 'Failed to restore backup', 'error');
            }
        } catch (error) {
            this.showAlert('backupAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async downloadBackup(backupFileName) {
        try {
            const response = await fetch(`/api/config/backups`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                // Create download link
                const link = document.createElement('a');
                link.href = `/backups/${backupFileName}`;
                link.download = backupFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                this.showAlert('backupAlert', `Downloading: ${backupFileName}`, 'success');
            } else {
                this.showAlert('backupAlert', 'Failed to download backup', 'error');
            }
        } catch (error) {
            this.showAlert('backupAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async uploadBackup() {
        const fileInput = document.getElementById('backupFileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showAlert('backupAlert', 'Please select a backup file', 'error');
            return;
        }

        if (!file.name.endsWith('.json')) {
            this.showAlert('backupAlert', 'Please select a valid JSON backup file', 'error');
            return;
        }

        try {
            // Read file content
            const fileContent = await file.text();
            const backupConfig = JSON.parse(fileContent);

            // Validate it looks like a config
            if (!backupConfig.apiUrl || !backupConfig.username) {
                throw new Error('Invalid backup file format');
            }

            // Confirm restore
            if (!confirm(`Are you sure you want to restore from uploaded file: ${file.name}?\n\nThis will overwrite the current configuration.`)) {
                return;
            }

            // Update configuration with backup data
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(backupConfig)
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('backupAlert', `Configuration restored from uploaded file: ${file.name}`, 'success');
                this.loadConfig(); // Reload current config
                this.loadStatus(); // Reload status
                fileInput.value = ''; // Clear file input
            } else {
                this.showAlert('backupAlert', data.message || 'Failed to restore from uploaded file', 'error');
            }
        } catch (error) {
            this.showAlert('backupAlert', 'Error processing backup file: ' + error.message, 'error');
        }
    }

    async resetConfig() {
        if (!confirm('Are you sure you want to reset configuration to default? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/config/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.populateConfigForm(data.config);
                this.showAlert('configAlert', 'Configuration reset to default successfully!', 'success');
                this.loadStatus();
            } else {
                this.showAlert('configAlert', data.message || 'Failed to reset configuration', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        }
    }

    populateConfigForm(config) {
        document.getElementById('apiUrl').value = config.apiUrl || '';
        document.getElementById('activationApiUrl').value = config.activationApiUrl || 'https://www.xtream.ro/appactivation';
        document.getElementById('isActive').value = config.isActive ? 'true' : 'false';
    }

    updateStatusDisplay(status) {
        document.getElementById('configStatus').textContent = status.exists ? 'Active' : 'Not Found';
        document.getElementById('lastUpdated').textContent = status.lastUpdated ?
            new Date(status.lastUpdated).toLocaleString() : 'Never';
        document.getElementById('backupCount').textContent = `${status.backupCount} backups`;
    }

    updateAppStatus(status) {
        document.getElementById('appStatus').textContent = status.status || 'Unknown';
    }

    showLogin() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');

        // Hide admin profile section
        const profileSection = document.getElementById('adminProfileSection');
        if (profileSection) {
            profileSection.classList.add('hidden');
            profileSection.style.display = 'none';
        }
    }

    showAdmin() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');

        // Show admin profile section
        const profileSection = document.getElementById('adminProfileSection');
        if (profileSection) {
            profileSection.classList.remove('hidden');
            profileSection.style.display = 'flex';
        }

        // Initialize with dashboard tab
        showTab('dashboard');

        // Load initial data
        this.loadConfig();
        this.loadStatus();
        this.loadBackups();
        updateDashboardStats();
    }

    async reloadConfig() {
        try {
            const response = await fetch('/api/config/reload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.populateConfigForm(data.config);
                this.showAlert('configAlert', 'Configuration reloaded successfully!', 'success');
                this.loadStatus();
            } else {
                this.showAlert('configAlert', data.message || 'Failed to reload configuration', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async testConnection() {
        try {
            this.showAlert('configAlert', 'Testing connections...', 'info');

            const response = await fetch('/api/config/test-connection', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                const results = data.results;
                let message = 'Connection Test Results:\n';

                if (results.apiUrl) {
                    message += `• API URL: ${results.apiUrl.status.toUpperCase()} - ${results.apiUrl.message}\n`;
                }

                if (results.activationApiUrl) {
                    message += `• Activation API: ${results.activationApiUrl.status.toUpperCase()} - ${results.activationApiUrl.message}`;
                }

                // Determine overall status
                const hasErrors = (results.apiUrl && results.apiUrl.status === 'error') ||
                                (results.activationApiUrl && results.activationApiUrl.status === 'error');
                const alertType = hasErrors ? 'error' : 'success';

                this.showAlert('configAlert', message, alertType);
            } else {
                this.showAlert('configAlert', data.message || 'Failed to test connection', 'error');
            }
        } catch (error) {
            this.showAlert('configAlert', 'Network error: ' + error.message, 'error');
        }
    }

    async viewLogs() {
        try {
            // Create logs modal if it doesn't exist
            if (!document.getElementById('logsModal')) {
                this.createLogsModal();
            }

            // Show the modal
            document.getElementById('logsModal').style.display = 'block';

            // Load log files list
            await this.loadLogFiles();
        } catch (error) {
            this.showAlert('configAlert', 'Failed to open logs viewer: ' + error.message, 'error');
        }
    }

    async logout() {
        try {
            // Call logout API to revoke session
            const sessionToken = localStorage.getItem('sessionToken');
            if (sessionToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'X-Session-Token': sessionToken,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            // Clear local storage regardless of API call result
            localStorage.removeItem('adminToken');
            localStorage.removeItem('sessionToken');
            this.token = null;
            this.showLogin();
            this.showAlert('loginAlert', 'Logged out successfully', 'success');
        }
    }

    createLogsModal() {
        const modalHtml = `
            <div id="logsModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📋 Log Viewer</h2>
                        <span class="close" onclick="document.getElementById('logsModal').style.display='none'">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="logs-controls">
                            <select id="logFileSelect" onchange="window.adminPanel.loadLogContent()">
                                <option value="">Select a log file...</option>
                            </select>
                            <button onclick="window.adminPanel.refreshLogFiles()" class="btn btn-small">Refresh</button>
                            <button onclick="window.adminPanel.clearCurrentLog()" class="btn btn-small btn-danger">Clear Log</button>
                        </div>
                        <div class="logs-search">
                            <input type="text" id="logSearchInput" placeholder="Search logs..." />
                            <button onclick="window.adminPanel.searchLogs()" class="btn btn-small">Search</button>
                        </div>
                        <div id="logContent" class="log-content">
                            <p>Select a log file to view its contents.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async loadLogFiles() {
        try {
            const response = await fetch('/api/logs', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                const select = document.getElementById('logFileSelect');
                select.innerHTML = '<option value="">Select a log file...</option>';

                data.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name;
                    option.textContent = `${file.name} (${this.formatFileSize(file.size)}) - ${new Date(file.modified).toLocaleString()}`;
                    select.appendChild(option);
                });
            } else {
                document.getElementById('logContent').innerHTML = `<p class="error">Failed to load log files: ${data.message}</p>`;
            }
        } catch (error) {
            document.getElementById('logContent').innerHTML = `<p class="error">Network error: ${error.message}</p>`;
        }
    }

    async loadLogContent() {
        const filename = document.getElementById('logFileSelect').value;
        if (!filename) {
            document.getElementById('logContent').innerHTML = '<p>Select a log file to view its contents.</p>';
            return;
        }

        try {
            const response = await fetch(`/api/logs/${filename}?lines=200`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                let content = `<div class="log-info">File: ${data.filename} | Total Lines: ${data.totalLines} | Showing: ${data.returnedLines} lines</div>`;
                content += '<div class="log-lines">';

                data.lines.forEach(line => {
                    if (line.parsed) {
                        const levelClass = line.level ? `log-${line.level.toLowerCase()}` : '';
                        content += `<div class="log-line ${levelClass}">
                            <span class="log-timestamp">${line.timestamp || ''}</span>
                            <span class="log-level">[${line.level || 'INFO'}]</span>
                            <span class="log-message">${this.escapeHtml(line.message || line.raw)}</span>
                        </div>`;
                    } else {
                        content += `<div class="log-line"><span class="log-raw">${this.escapeHtml(line.raw)}</span></div>`;
                    }
                });

                content += '</div>';
                document.getElementById('logContent').innerHTML = content;

                // Scroll to bottom
                const logContent = document.getElementById('logContent');
                logContent.scrollTop = logContent.scrollHeight;
            } else {
                document.getElementById('logContent').innerHTML = `<p class="error">Failed to load log content: ${data.message}</p>`;
            }
        } catch (error) {
            document.getElementById('logContent').innerHTML = `<p class="error">Network error: ${error.message}</p>`;
        }
    }

    async refreshLogFiles() {
        await this.loadLogFiles();
        this.showAlert('configAlert', 'Log files refreshed', 'success');
    }

    async clearCurrentLog() {
        const filename = document.getElementById('logFileSelect').value;
        if (!filename) {
            alert('Please select a log file first');
            return;
        }

        if (!confirm(`Are you sure you want to clear the log file "${filename}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/logs/${filename}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('configAlert', `Log file "${filename}" cleared successfully`, 'success');
                await this.loadLogContent(); // Refresh the content
            } else {
                alert(`Failed to clear log file: ${data.message}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        }
    }

    async searchLogs() {
        const query = document.getElementById('logSearchInput').value.trim();
        const filename = document.getElementById('logFileSelect').value;

        if (!query) {
            alert('Please enter a search query');
            return;
        }

        try {
            const response = await fetch('/api/logs/search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query,
                    filename: filename || undefined,
                    maxResults: 100
                })
            });

            const data = await response.json();

            if (response.ok) {
                let content = `<div class="log-info">Search Results for "${query}" | Found: ${data.totalResults} matches</div>`;
                content += '<div class="log-lines">';

                data.results.forEach(result => {
                    content += `<div class="log-line log-search-result">
                        <span class="log-file">[${result.filename}:${result.lineNumber}]</span>
                        <span class="log-content">${this.escapeHtml(result.content)}</span>
                    </div>`;
                });

                content += '</div>';
                document.getElementById('logContent').innerHTML = content;
            } else {
                document.getElementById('logContent').innerHTML = `<p class="error">Search failed: ${data.message}</p>`;
            }
        } catch (error) {
            document.getElementById('logContent').innerHTML = `<p class="error">Network error: ${error.message}</p>`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAlert(containerId, message, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }

    setLoading(formId, loading) {
        const form = document.getElementById(formId);
        if (loading) {
            form.classList.add('loading');
        } else {
            form.classList.remove('loading');
        }
    }
}

// Global functions for button clicks
function loadConfig() {
    console.log('loadConfig button clicked');
    if (window.adminPanel && window.adminPanel.reloadConfig) {
        window.adminPanel.reloadConfig();
    } else {
        console.error('adminPanel.reloadConfig not found');
        alert('Error: reloadConfig function not available');
    }
}

function createBackup() {
    console.log('createBackup button clicked');
    if (window.adminPanel && window.adminPanel.createBackup) {
        window.adminPanel.createBackup();
    } else {
        console.error('adminPanel.createBackup not found');
        alert('Error: createBackup function not available');
    }
}

function loadBackups() {
    console.log('loadBackups button clicked');
    if (window.adminPanel && window.adminPanel.loadBackups) {
        window.adminPanel.loadBackups();
    } else {
        console.error('adminPanel.loadBackups not found');
        alert('Error: loadBackups function not available');
    }
}

function restoreBackup(backupFileName) {
    console.log('restoreBackup button clicked:', backupFileName);
    if (window.adminPanel && window.adminPanel.restoreBackup) {
        window.adminPanel.restoreBackup(backupFileName);
    } else {
        console.error('adminPanel.restoreBackup not found');
        alert('Error: restoreBackup function not available');
    }
}

function downloadBackup(backupFileName) {
    console.log('downloadBackup button clicked:', backupFileName);
    if (window.adminPanel && window.adminPanel.downloadBackup) {
        window.adminPanel.downloadBackup(backupFileName);
    } else {
        console.error('adminPanel.downloadBackup not found');
        alert('Error: downloadBackup function not available');
    }
}

function uploadBackup() {
    console.log('uploadBackup button clicked');
    if (window.adminPanel && window.adminPanel.uploadBackup) {
        window.adminPanel.uploadBackup();
    } else {
        console.error('adminPanel.uploadBackup not found');
        alert('Error: uploadBackup function not available');
    }
}

function resetConfig() {
    console.log('resetConfig button clicked');
    if (window.adminPanel && window.adminPanel.resetToDefault) {
        window.adminPanel.resetToDefault();
    } else {
        console.error('adminPanel.resetToDefault not found');
        alert('Error: resetToDefault function not available');
    }
}

// Quick Actions Functions - Made more robust
window.testConnection = async function() {
    console.log('🔗 testConnection button clicked');

    // Show immediate feedback
    const button = event?.target?.closest('button');
    if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        button.disabled = true;

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 5000);
    }

    try {
        console.log('Testing connection...');
        showAlert('Testing connections...', 'info');

        const token = localStorage.getItem('adminToken');
        console.log('Using token:', token ? 'Token exists' : 'No token');

        const response = await fetch('/api/config/test-connection', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
            const { results, summary } = data;
            let message = `Connection Test Results: ${summary.successful}/${summary.total} successful`;

            // Add details for each test
            if (results.apiUrl) {
                message += `\n• API URL: ${results.apiUrl.status} - ${results.apiUrl.message}`;
            }
            if (results.activationApiUrl) {
                message += `\n• Activation API: ${results.activationApiUrl.status} - ${results.activationApiUrl.message}`;
            }

            const alertType = data.success ? 'success' : summary.successful > 0 ? 'warning' : 'error';
            showAlert(message, alertType, 8000); // Show for 8 seconds
        } else {
            showAlert(`Connection test failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        showAlert(`Connection test failed: ${error.message}`, 'error');
    }
};

window.viewLogs = async function() {
    console.log('📋 viewLogs button clicked');
    try {
        showAlert('Loading system logs...', 'info');

        const token = localStorage.getItem('adminToken');
        if (!token) {
            showAlert('Authentication required to view logs', 'error');
            return;
        }

        // Fetch logs data with authentication
        const response = await fetch('/api/logs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Logs data:', data);

        // Create and show logs modal
        showLogsModal(data);
        showAlert('System logs loaded successfully', 'success');

    } catch (error) {
        console.error('Error loading logs:', error);
        showAlert(`Failed to load logs: ${error.message}`, 'error');
    }
};

// Show logs in a modal
function showLogsModal(logsData) {
    const modal = document.getElementById('logsModal');
    const logsContent = document.getElementById('logsContent');

    if (!modal || !logsContent) {
        console.error('Logs modal elements not found');
        return;
    }

    // Clear previous content
    logsContent.innerHTML = '';

    if (!logsData.files || logsData.files.length === 0) {
        logsContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                <h3>No Log Files Found</h3>
                <p>No log files are available to display.</p>
            </div>
        `;
    } else {
        // Create logs interface
        logsContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="color: var(--text-primary); margin-bottom: 16px;">
                    <i class="fas fa-file-alt" style="margin-right: 8px;"></i>
                    System Log Files (${logsData.files.length})
                </h3>
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <select id="logFileSelect" style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-surface); color: var(--text-primary);">
                        <option value="">Select a log file...</option>
                        ${logsData.files.map(file => `
                            <option value="${file.name}">${file.name} (${(file.size / 1024).toFixed(1)} KB)</option>
                        `).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="loadSelectedLogFile()">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="refreshLogsList()">
                        <i class="fas fa-sync"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="logFileContent" style="background: var(--dark-surface-light); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; max-height: 400px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4;">
                <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                    <i class="fas fa-arrow-up" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    Select a log file above to view its contents
                </div>
            </div>

            <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                <div style="color: var(--text-secondary); font-size: 14px;">
                    <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                    Showing most recent log files first
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-warning btn-sm" onclick="downloadCurrentLog()" id="downloadLogBtn" disabled>
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="closeModal('logsModal')">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
        `;
    }

    // Show the modal
    showModal('logsModal');
}

// Load selected log file content
window.loadSelectedLogFile = async function() {
    const select = document.getElementById('logFileSelect');
    const contentDiv = document.getElementById('logFileContent');
    const downloadBtn = document.getElementById('downloadLogBtn');

    if (!select.value) {
        showAlert('Please select a log file first', 'warning');
        return;
    }

    try {
        contentDiv.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                Loading log file: ${select.value}
            </div>
        `;

        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/logs/${select.value}?lines=500`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Display log content
        if (data.lines && data.lines.length > 0) {
            const logLines = data.lines.map(line => {
                if (line.parsed) {
                    const levelColor = {
                        'error': '#ef4444',
                        'warn': '#f59e0b',
                        'info': '#3b82f6',
                        'debug': '#6b7280'
                    }[line.level] || '#6b7280';

                    return `
                        <div style="margin-bottom: 4px; padding: 4px 8px; border-left: 3px solid ${levelColor}; background: rgba(${levelColor.replace('#', '')}, 0.1);">
                            <span style="color: var(--text-muted); font-size: 11px;">[${line.timestamp}]</span>
                            <span style="color: ${levelColor}; font-weight: bold; margin: 0 8px;">${line.level.toUpperCase()}</span>
                            <span style="color: var(--text-primary);">${line.message}</span>
                        </div>
                    `;
                } else {
                    return `
                        <div style="margin-bottom: 2px; padding: 2px 8px; color: var(--text-secondary);">
                            ${line.raw}
                        </div>
                    `;
                }
            }).join('');

            contentDiv.innerHTML = `
                <div style="margin-bottom: 12px; padding: 8px; background: var(--dark-surface); border-radius: 4px; font-size: 11px; color: var(--text-secondary);">
                    <strong>${data.filename}</strong> - Showing ${data.returnedLines} of ${data.totalLines} lines
                    ${data.totalLines > data.returnedLines ? ' (showing most recent)' : ''}
                </div>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${logLines}
                </div>
            `;

            downloadBtn.disabled = false;
        } else {
            contentDiv.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                    <i class="fas fa-file" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    Log file is empty
                </div>
            `;
            downloadBtn.disabled = true;
        }

    } catch (error) {
        console.error('Error loading log file:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; color: var(--error-color); padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                <strong>Error loading log file</strong><br>
                ${error.message}
            </div>
        `;
        downloadBtn.disabled = true;
        showAlert(`Failed to load log file: ${error.message}`, 'error');
    }
};

// Refresh logs list
window.refreshLogsList = async function() {
    try {
        showAlert('Refreshing logs list...', 'info');
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/logs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        showLogsModal(data);
        showAlert('Logs list refreshed', 'success');

    } catch (error) {
        console.error('Error refreshing logs:', error);
        showAlert(`Failed to refresh logs: ${error.message}`, 'error');
    }
};

// Download current log file
window.downloadCurrentLog = async function() {
    const select = document.getElementById('logFileSelect');

    if (!select.value) {
        showAlert('Please select a log file first', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/logs/${select.value}?lines=10000`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Create downloadable content
        const logContent = data.lines.map(line => line.raw).join('\n');
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = select.value;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showAlert(`Log file "${select.value}" downloaded successfully`, 'success');

    } catch (error) {
        console.error('Error downloading log file:', error);
        showAlert(`Failed to download log file: ${error.message}`, 'error');
    }
};

window.createBackup = async function() {
    console.log('💾 createBackup button clicked');

    // Show immediate feedback
    const button = event?.target?.closest('button');
    if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        button.disabled = true;

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 5000);
    }

    try {
        showAlert('Creating backup...', 'info');

        const token = localStorage.getItem('adminToken');
        console.log('Creating backup with token:', token ? 'Token exists' : 'No token');

        const response = await fetch('/api/config/backup', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Backup response status:', response.status);
        const data = await response.json();
        console.log('Backup response data:', data);

        if (response.ok) {
            showAlert(`Backup created successfully: ${data.backupFileName}`, 'success');
        } else {
            showAlert(`Backup failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showAlert(`Backup failed: ${error.message}`, 'error');
    }
};

window.logout = async function() {
    console.log('🚪 logout button clicked');

    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    // Show immediate feedback
    const button = event?.target?.closest('button');
    if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        button.disabled = true;
    }

    try {
        const token = localStorage.getItem('adminToken');
        const sessionToken = localStorage.getItem('sessionToken');

        console.log('Logging out with token:', token ? 'Token exists' : 'No token');

        if (token) {
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Session-Token': sessionToken,
                        'Content-Type': 'application/json'
                    }
                });
                console.log('Logout API response:', response.status);
            } catch (error) {
                console.error('Error during logout API call:', error);
            }
        }

        // Clear local storage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('sessionToken');

        showAlert('Logged out successfully', 'success');

        // Reload page to show login
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Error during logout:', error);
        showAlert(`Logout failed: ${error.message}`, 'error');

        // Still try to reload on error
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
};

// Ensure functions are globally accessible for onclick handlers
console.log('🔧 Setting up global function access...');

// Quick Actions
if (typeof window.testConnection !== 'function') {
    console.error('❌ testConnection not found!');
} else {
    console.log('✅ testConnection ready');
}

if (typeof window.viewLogs !== 'function') {
    console.error('❌ viewLogs not found!');
} else {
    console.log('✅ viewLogs ready');
}

if (typeof window.createBackup !== 'function') {
    console.error('❌ createBackup not found!');
} else {
    console.log('✅ createBackup ready');
}

if (typeof window.logout !== 'function') {
    console.error('❌ logout not found!');
} else {
    console.log('✅ logout ready');
}

// Admin Management
if (typeof window.deleteAdmin !== 'function') {
    console.error('❌ deleteAdmin not found!');
} else {
    console.log('✅ deleteAdmin ready');
}

// Initialize the admin panel when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AdminPanel');
    window.adminPanel = new AdminPanel();
    console.log('AdminPanel initialized:', window.adminPanel);
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.adminPanel)));

    // Ensure all functions are globally accessible
    console.log('Ensuring global function access...');
    console.log('testConnection available:', typeof window.testConnection);
    console.log('viewLogs available:', typeof window.viewLogs);
    console.log('createBackup available:', typeof window.createBackup);
    console.log('logout available:', typeof window.logout);
    console.log('deleteAdmin available:', typeof window.deleteAdmin);
});
