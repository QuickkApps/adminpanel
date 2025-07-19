/**
 * Test script to verify Flutter app integration with admin panel
 * This script monitors the admin panel for incoming requests from the Flutter app
 */

const axios = require('axios');

const ADMIN_PANEL_URL = 'http://localhost:3001';

class FlutterIntegrationTester {
    constructor() {
        this.token = null;
        this.initialAppStatus = null;
        this.testResults = {
            adminPanelHealth: false,
            authentication: false,
            configRetrieval: false,
            configUpdate: false,
            statusReporting: false,
            errorReporting: false,
            lifecycleEvents: false
        };
    }

    async login() {
        console.log('🔐 Logging into admin panel...');
        try {
            const response = await axios.post(`${ADMIN_PANEL_URL}/api/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });
            
            this.token = response.data.token;
            console.log('✅ Admin panel login successful');
            this.testResults.authentication = true;
            return true;
        } catch (error) {
            console.error('❌ Admin panel login failed:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async testAdminPanelHealth() {
        console.log('\n🏥 Testing admin panel health...');
        try {
            const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/ping`);
            console.log('✅ Admin panel is healthy:', response.data.message);
            this.testResults.adminPanelHealth = true;
            return true;
        } catch (error) {
            console.error('❌ Admin panel health check failed:', error.message);
            return false;
        }
    }

    async testConfigRetrieval() {
        console.log('\n📋 Testing configuration retrieval...');
        try {
            const response = await axios.get(`${ADMIN_PANEL_URL}/api/config`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            
            console.log('✅ Configuration retrieved successfully:');
            console.log(`   API URL: ${response.data.config.apiUrl}`);
            console.log(`   Username: ${response.data.config.username}`);
            console.log(`   Status: ${response.data.config.isActive ? 'Active' : 'Inactive'}`);
            console.log(`   Last Updated: ${response.data.config.lastUpdated}`);
            
            this.testResults.configRetrieval = true;
            return response.data.config;
        } catch (error) {
            console.error('❌ Configuration retrieval failed:', error.response?.data?.message || error.message);
            return null;
        }
    }

    async testConfigUpdate() {
        console.log('\n🔧 Testing configuration update...');
        try {
            const newConfig = {
                apiUrl: 'http://test-integration.example.com:8080',
                username: 'integration_test',
                password: 'test_password',
                isActive: true
            };

            const response = await axios.put(`${ADMIN_PANEL_URL}/api/config`, newConfig, {
                headers: { 
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Configuration updated successfully:');
            console.log(`   New API URL: ${response.data.config.apiUrl}`);
            console.log(`   New Username: ${response.data.config.username}`);
            
            this.testResults.configUpdate = true;
            return true;
        } catch (error) {
            console.error('❌ Configuration update failed:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async waitForFlutterAppStatus() {
        console.log('\n⏳ Waiting for Flutter app status updates...');
        console.log('   Please start your Flutter app now to see status updates');
        
        let attempts = 0;
        const maxAttempts = 30; // Wait up to 5 minutes
        
        while (attempts < maxAttempts) {
            try {
                const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/status`);
                const appStatus = response.data.appStatus;
                
                if (appStatus.lastSeen && appStatus.status !== 'unknown') {
                    console.log('✅ Flutter app status received:');
                    console.log(`   Status: ${appStatus.status}`);
                    console.log(`   Last Seen: ${appStatus.lastSeen}`);
                    console.log(`   Version: ${appStatus.version || 'N/A'}`);
                    console.log(`   Active Users: ${appStatus.activeUsers || 0}`);
                    
                    this.testResults.statusReporting = true;
                    this.initialAppStatus = appStatus;
                    return true;
                }
                
                attempts++;
                if (attempts % 5 === 0) {
                    console.log(`   Still waiting... (${attempts}/${maxAttempts})`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            } catch (error) {
                console.error('❌ Error checking app status:', error.message);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        console.log('⏰ Timeout waiting for Flutter app status');
        return false;
    }

    async checkForErrors() {
        console.log('\n🚨 Checking for error reports...');
        try {
            const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/status`);
            const errors = response.data.appStatus.errors || [];
            
            if (errors.length > 0) {
                console.log(`✅ Found ${errors.length} error report(s):`);
                errors.slice(0, 3).forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.message}`);
                    if (error.context?.service) {
                        console.log(`      Service: ${error.context.service}`);
                    }
                });
                this.testResults.errorReporting = true;
            } else {
                console.log('ℹ️ No error reports found (this is normal if the app is working correctly)');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error checking error reports:', error.message);
            return false;
        }
    }

    async testLifecycleEvents() {
        console.log('\n🔄 Testing lifecycle events...');
        console.log('   Please minimize and restore your Flutter app to test lifecycle events');
        
        const initialStatus = this.initialAppStatus;
        let lifecycleDetected = false;
        let attempts = 0;
        const maxAttempts = 12; // Wait up to 2 minutes
        
        while (attempts < maxAttempts && !lifecycleDetected) {
            try {
                const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/status`);
                const currentStatus = response.data.appStatus;
                
                if (currentStatus.lastSeen !== initialStatus?.lastSeen) {
                    console.log('✅ Lifecycle event detected:');
                    console.log(`   Status changed: ${currentStatus.status}`);
                    console.log(`   Last update: ${currentStatus.lastSeen}`);
                    
                    this.testResults.lifecycleEvents = true;
                    lifecycleDetected = true;
                    return true;
                }
                
                attempts++;
                if (attempts % 3 === 0) {
                    console.log(`   Still waiting for lifecycle events... (${attempts}/${maxAttempts})`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            } catch (error) {
                console.error('❌ Error checking lifecycle events:', error.message);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        console.log('ℹ️ No lifecycle events detected (try minimizing/restoring the app)');
        return false;
    }

    async resetConfigToDefault() {
        console.log('\n🔄 Resetting configuration to default...');
        try {
            await axios.post(`${ADMIN_PANEL_URL}/api/config/reset`, {}, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            console.log('✅ Configuration reset to default');
            return true;
        } catch (error) {
            console.error('❌ Failed to reset configuration:', error.message);
            return false;
        }
    }

    printTestResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 FLUTTER INTEGRATION TEST RESULTS');
        console.log('='.repeat(60));
        
        const results = [
            ['Admin Panel Health', this.testResults.adminPanelHealth],
            ['Authentication', this.testResults.authentication],
            ['Configuration Retrieval', this.testResults.configRetrieval],
            ['Configuration Update', this.testResults.configUpdate],
            ['Status Reporting', this.testResults.statusReporting],
            ['Error Reporting', this.testResults.errorReporting],
            ['Lifecycle Events', this.testResults.lifecycleEvents]
        ];
        
        results.forEach(([test, passed]) => {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${test}`);
        });
        
        const passedTests = results.filter(([, passed]) => passed).length;
        const totalTests = results.length;
        
        console.log('\n' + '='.repeat(60));
        console.log(`📈 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 ALL TESTS PASSED! Flutter integration is working perfectly!');
        } else if (passedTests >= totalTests - 2) {
            console.log('✅ Integration is mostly working. Some optional features may need attention.');
        } else {
            console.log('⚠️ Integration needs attention. Please check the failed tests.');
        }
        
        console.log('\n📋 Next Steps:');
        if (this.testResults.statusReporting) {
            console.log('✅ Your Flutter app is successfully communicating with the admin panel');
        } else {
            console.log('❌ Flutter app is not sending status updates. Check the integration code.');
        }
        
        if (this.testResults.configUpdate) {
            console.log('✅ Configuration updates are working correctly');
        } else {
            console.log('❌ Configuration updates failed. Check admin panel permissions.');
        }
        
        console.log('\n🌐 Admin Panel: http://localhost:3001');
        console.log('🔑 Login: admin / admin123');
    }

    async runFullTest() {
        console.log('🧪 Starting Flutter Integration Test Suite\n');
        
        // Test 1: Admin Panel Health
        await this.testAdminPanelHealth();
        
        // Test 2: Authentication
        const loginSuccess = await this.login();
        if (!loginSuccess) return;
        
        // Test 3: Configuration Retrieval
        await this.testConfigRetrieval();
        
        // Test 4: Configuration Update
        await this.testConfigUpdate();
        
        // Test 5: Wait for Flutter App Status
        await this.waitForFlutterAppStatus();
        
        // Test 6: Check for Error Reports
        await this.checkForErrors();
        
        // Test 7: Test Lifecycle Events
        await this.testLifecycleEvents();
        
        // Reset configuration
        await this.resetConfigToDefault();
        
        // Print results
        this.printTestResults();
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    const tester = new FlutterIntegrationTester();
    tester.runFullTest().catch(console.error);
}

module.exports = FlutterIntegrationTester;
