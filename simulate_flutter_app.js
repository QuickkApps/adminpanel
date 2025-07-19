/**
 * Simulate Flutter app behavior to test admin panel integration
 * This script mimics what the Flutter app would do when integrated
 */

const axios = require('axios');

const ADMIN_PANEL_URL = 'http://localhost:3001';

class FlutterAppSimulator {
    constructor() {
        this.isRunning = false;
        this.statusInterval = null;
    }

    async initialize() {
        console.log('🚀 Flutter App Simulator Starting...');
        
        // Simulate app startup
        await this.sendStatusUpdate('starting', '1.0.0');
        
        // Simulate initialization complete
        setTimeout(async () => {
            await this.sendStatusUpdate('running', '1.0.0');
            console.log('✅ App initialization complete');
        }, 2000);
        
        // Start periodic status updates
        this.startPeriodicStatusUpdates();
        
        // Simulate some app activities
        this.simulateAppActivities();
        
        this.isRunning = true;
        console.log('📱 Flutter app simulation is running...');
        console.log('   Press Ctrl+C to stop');
    }

    async sendStatusUpdate(status, version = '1.0.0', activeUsers = 1, errors = []) {
        try {
            const statusData = {
                status,
                version,
                configVersion: new Date().toISOString(),
                activeUsers,
                errors
            };

            const response = await axios.post(`${ADMIN_PANEL_URL}/api/app/status`, statusData, {
                timeout: 5000
            });

            console.log(`📊 Status sent: ${status} (${response.status})`);
            return true;
        } catch (error) {
            console.log(`❌ Failed to send status: ${error.message}`);
            return false;
        }
    }

    async reportError(error, context = {}) {
        try {
            const errorData = {
                error,
                stack: `Error: ${error}\n    at FlutterApp.someMethod\n    at AuthProvider.authenticate`,
                context: {
                    ...context,
                    timestamp: new Date().toISOString(),
                    simulator: true
                }
            };

            const response = await axios.post(`${ADMIN_PANEL_URL}/api/app/error`, errorData, {
                timeout: 5000
            });

            console.log(`🚨 Error reported: ${error} (${response.status})`);
            return true;
        } catch (error) {
            console.log(`❌ Failed to report error: ${error.message}`);
            return false;
        }
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

    startPeriodicStatusUpdates() {
        // Send status update every 30 seconds
        this.statusInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.sendStatusUpdate('running', '1.0.0', Math.floor(Math.random() * 5) + 1);
            }
        }, 30000);
    }

    async simulateAppActivities() {
        // Simulate various app activities with delays
        
        // Simulate authentication attempt after 5 seconds
        setTimeout(async () => {
            console.log('🔐 Simulating authentication...');
            await this.sendStatusUpdate('authenticating');
            
            // Simulate successful auth after 2 seconds
            setTimeout(async () => {
                await this.sendStatusUpdate('authenticated', '1.0.0', 1);
                console.log('✅ Authentication successful');
            }, 2000);
        }, 5000);

        // Simulate configuration reload after 10 seconds
        setTimeout(async () => {
            console.log('⚙️ Simulating configuration reload...');
            await this.sendStatusUpdate('config_reloaded');
        }, 10000);

        // Simulate an error after 15 seconds
        setTimeout(async () => {
            console.log('🚨 Simulating error condition...');
            await this.reportError('Simulated network timeout', {
                service: 'XtreamService',
                method: 'authenticate',
                url: 'http://test-server.example.com:8080'
            });
        }, 15000);

        // Simulate app lifecycle events
        setTimeout(async () => {
            console.log('📱 Simulating app lifecycle: paused');
            await this.sendStatusUpdate('paused', '1.0.0', 0);
        }, 20000);

        setTimeout(async () => {
            console.log('📱 Simulating app lifecycle: resumed');
            await this.sendStatusUpdate('resumed', '1.0.0', 1);
        }, 25000);

        // Simulate periodic activities
        setInterval(async () => {
            if (this.isRunning) {
                const activities = [
                    () => this.sendStatusUpdate('loading_channels'),
                    () => this.sendStatusUpdate('playing_video'),
                    () => this.sendStatusUpdate('browsing_content'),
                    () => this.reportError('Minor connection hiccup', { severity: 'low' })
                ];

                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                await randomActivity();
                
                // Return to running state
                setTimeout(async () => {
                    await this.sendStatusUpdate('running');
                }, 2000);
            }
        }, 60000); // Every minute
    }

    async stop() {
        console.log('\n🛑 Stopping Flutter app simulation...');
        this.isRunning = false;
        
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        
        // Send final status
        await this.sendStatusUpdate('stopping');
        
        setTimeout(async () => {
            await this.sendStatusUpdate('stopped', '1.0.0', 0);
            console.log('✅ Flutter app simulation stopped');
            process.exit(0);
        }, 1000);
    }

    async testConfigurationReading() {
        console.log('\n📋 Testing configuration reading simulation...');
        
        // In a real Flutter app, this would be done by RemoteConfigReader
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const configPath = path.resolve('../anume/lib/config/remote_config.json');
            
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            console.log('✅ Configuration read successfully:');
            console.log(`   API URL: ${config.apiUrl}`);
            console.log(`   Username: ${config.username}`);
            console.log(`   Status: ${config.isActive ? 'Active' : 'Inactive'}`);
            console.log(`   Last Updated: ${config.lastUpdated}`);
            
            // Report that config was read
            await this.sendStatusUpdate('config_loaded', '1.0.0', 1);
            
            return config;
        } catch (error) {
            console.log('❌ Failed to read configuration:', error.message);
            await this.reportError('Failed to read configuration', {
                service: 'RemoteConfigReader',
                error: error.message
            });
            return null;
        }
    }
}

// Handle graceful shutdown
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
let simulator;

async function main() {
    simulator = new FlutterAppSimulator();
    
    // Check if admin panel is available
    console.log('🔍 Checking admin panel availability...');
    const isHealthy = await simulator.checkAdminPanelHealth();
    
    if (!isHealthy) {
        console.log('❌ Admin panel is not available at http://localhost:3001');
        console.log('   Please make sure the admin panel is running:');
        console.log('   cd admin_panel && npm start');
        process.exit(1);
    }
    
    console.log('✅ Admin panel is available');
    
    // Test configuration reading
    await simulator.testConfigurationReading();
    
    // Start simulation
    await simulator.initialize();
    
    // Keep the process running
    console.log('\n📊 Monitoring admin panel integration...');
    console.log('   Open http://localhost:3001 to see real-time updates');
    console.log('   This simulation will run indefinitely until stopped');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FlutterAppSimulator;
