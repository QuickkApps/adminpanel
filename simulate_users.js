/**
 * Simulate real users connecting to test online user tracking
 * This script creates realistic user sessions and activities
 */

const axios = require('axios');
const { faker } = require('@faker-js/faker');

const ADMIN_PANEL_URL = 'http://localhost:3001';

class UserSimulator {
    constructor() {
        this.users = [];
        this.activeSessions = new Map();
        this.isRunning = false;
    }

    async initialize() {
        console.log('👥 User Simulator Starting...');
        console.log('🔍 Checking admin panel availability...');
        
        const isHealthy = await this.checkAdminPanelHealth();
        if (!isHealthy) {
            console.log('❌ Admin panel is not available at http://localhost:3001');
            console.log('   Please make sure the admin panel is running:');
            console.log('   cd admin_panel && npm start');
            process.exit(1);
        }
        
        console.log('✅ Admin panel is available');
        
        // Create some test users
        await this.createTestUsers();
        
        // Start simulating user activities
        this.isRunning = true;
        this.simulateUserActivities();
        
        console.log('📱 User simulation is running...');
        console.log('   Press Ctrl+C to stop');
    }

    async checkAdminPanelHealth() {
        try {
            const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/ping`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async createTestUsers() {
        console.log('👤 Creating test users...');
        
        const testUsers = [
            {
                username: 'testuser1',
                server_url: 'http://demo-server1.example.com:8080',
                subscription_type: 'premium',
                subscription_status: 'active',
                max_connections: 3
            },
            {
                username: 'testuser2', 
                server_url: 'http://demo-server2.example.com:8080',
                subscription_type: 'basic',
                subscription_status: 'active',
                max_connections: 1
            },
            {
                username: 'testuser3',
                server_url: 'http://demo-server1.example.com:8080', 
                subscription_type: 'trial',
                subscription_status: 'active',
                max_connections: 1
            },
            {
                username: 'testuser4',
                server_url: 'http://demo-server3.example.com:8080',
                subscription_type: 'premium',
                subscription_status: 'expired',
                max_connections: 2
            }
        ];

        for (const userData of testUsers) {
            try {
                // Create user via direct database insertion (simulating app registration)
                const user = await this.createUser(userData);
                this.users.push(user);
                console.log(`✅ Created user: ${userData.username}`);
            } catch (error) {
                console.log(`❌ Failed to create user ${userData.username}: ${error.message}`);
            }
        }
        
        console.log(`📊 Created ${this.users.length} test users`);
    }

    async createUser(userData) {
        // Simulate user creation via API (like the Flutter app would do)
        try {
            // Create a mock user object that would be sent by the Flutter app
            const user = {
                id: Date.now() + Math.floor(Math.random() * 1000), // Mock ID
                username: userData.username,
                server_url: userData.server_url,
                subscription_type: userData.subscription_type,
                subscription_status: userData.subscription_status,
                max_connections: userData.max_connections,
                last_ip: faker.internet.ip(),
                app_version: '1.0.0',
                is_active: userData.subscription_status === 'active',
                is_online: false,
                created_at: new Date().toISOString(),
                last_login: null
            };

            return user;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async simulateUserLogin(user) {
        try {
            // Create a mock session
            const session = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                user_id: user.id,
                connection_type: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet', 'tv']),
                ip_address: faker.internet.ip(),
                user_agent: faker.internet.userAgent(),
                app_version: '1.0.0',
                started_at: new Date().toISOString(),
                status: 'active'
            };

            this.activeSessions.set(user.id, session);
            user.is_online = true;
            user.last_login = new Date().toISOString();

            console.log(`🔐 User ${user.username} logged in (Session ID: ${session.id})`);

            // Send status update to admin panel
            await this.sendUserStatusUpdate(user, 'connected');

            return session;
        } catch (error) {
            console.error(`Error simulating login for ${user.username}:`, error);
            return null;
        }
    }

    async simulateUserLogout(user) {
        try {
            const session = this.activeSessions.get(user.id);
            if (!session) return;

            // End the session
            session.status = 'ended';
            session.ended_at = new Date().toISOString();

            this.activeSessions.delete(user.id);
            user.is_online = false;

            console.log(`🚪 User ${user.username} logged out`);

            // Send status update to admin panel
            await this.sendUserStatusUpdate(user, 'disconnected');

        } catch (error) {
            console.error(`Error simulating logout for ${user.username}:`, error);
        }
    }

    async sendUserStatusUpdate(user, status) {
        try {
            // Map our status to valid admin panel status values
            const validStatus = status === 'connected' || status === 'disconnected' ? 'running' : 'running';

            // This simulates what the Flutter app would send
            await axios.post(`${ADMIN_PANEL_URL}/api/app/status`, {
                status: validStatus,
                version: '1.0.0',
                activeUsers: this.activeSessions.size,
                configVersion: new Date().toISOString(),
                errors: []
            }, { timeout: 5000 });

            console.log(`📡 Status update sent: ${status} (${validStatus}) - ${this.activeSessions.size} users online`);
        } catch (error) {
            console.log(`❌ Failed to send status update: ${error.response?.data?.message || error.message}`);
        }
    }

    simulateUserActivities() {
        // Simulate users logging in and out randomly
        setInterval(() => {
            if (!this.isRunning) return;
            
            const user = faker.helpers.arrayElement(this.users);
            const isOnline = this.activeSessions.has(user.id);
            
            if (isOnline) {
                // 30% chance to logout
                if (Math.random() < 0.3) {
                    this.simulateUserLogout(user);
                }
            } else {
                // 50% chance to login (if not expired)
                if (Math.random() < 0.5 && user.subscription_status === 'active') {
                    this.simulateUserLogin(user);
                }
            }
        }, 5000); // Every 5 seconds
        
        // Simulate periodic activities for online users
        setInterval(() => {
            if (!this.isRunning) return;
            
            this.activeSessions.forEach(async (session, userId) => {
                const user = this.users.find(u => u.id === userId);
                if (user) {
                    // Simulate various activities
                    const activities = ['watching', 'browsing', 'searching', 'idle'];
                    const activity = faker.helpers.arrayElement(activities);
                    
                    await this.sendUserStatusUpdate(user, `active_${activity}`);
                }
            });
        }, 30000); // Every 30 seconds
        
        // Log current status periodically
        setInterval(() => {
            if (!this.isRunning) return;
            
            console.log(`📊 Status: ${this.activeSessions.size} users online out of ${this.users.length} total users`);
            
            // List online users
            if (this.activeSessions.size > 0) {
                const onlineUsernames = Array.from(this.activeSessions.keys())
                    .map(userId => this.users.find(u => u.id === userId)?.username)
                    .filter(Boolean);
                console.log(`   Online: ${onlineUsernames.join(', ')}`);
            }
        }, 15000); // Every 15 seconds
    }

    async stop() {
        console.log('\n🛑 Stopping user simulation...');
        this.isRunning = false;
        
        // Log out all users
        for (const [userId] of this.activeSessions) {
            const user = this.users.find(u => u.id === userId);
            if (user) {
                await this.simulateUserLogout(user);
            }
        }
        
        console.log('✅ User simulation stopped');
        process.exit(0);
    }
}

// Handle graceful shutdown
let simulator;

process.on('SIGINT', async () => {
    if (simulator) {
        await simulator.stop();
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', async () => {
    if (simulator) {
        await simulator.stop();
    } else {
        process.exit(0);
    }
});

// Main execution
async function main() {
    simulator = new UserSimulator();
    await simulator.initialize();
    
    console.log('\n📊 Monitoring user activities...');
    console.log('   Open http://localhost:3001 to see real-time updates');
    console.log('   Check the "Online Users" and "User Management" tabs');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = UserSimulator;
