const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

class ContentManagementTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.authToken = null;
        this.testResults = {
            serverStart: false,
            databaseInit: false,
            authentication: false,
            contentFetch: false,
            contentUpdate: false,
            realTimeSync: false,
            errorHandling: false
        };
    }

    async runTests() {
        console.log('🧪 Starting Content Management Integration Tests\n');
        console.log('=' .repeat(60));

        try {
            // Test 1: Server startup
            await this.testServerStartup();
            
            // Test 2: Authentication
            await this.testAuthentication();
            
            // Test 3: Content fetching
            await this.testContentFetching();
            
            // Test 4: Content updating
            await this.testContentUpdating();
            
            // Test 5: Error handling
            await this.testErrorHandling();
            
            // Print results
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
    }

    async testServerStartup() {
        console.log('🚀 Test 1: Server Startup');
        
        try {
            // Check if server is already running
            const response = await axios.get(`${this.baseUrl}/api`, { timeout: 5000 });
            if (response.status === 200) {
                console.log('✅ Server is running');
                this.testResults.serverStart = true;
                return;
            }
        } catch (error) {
            console.log('⚠️  Server not running, attempting to start...');
        }

        // If server is not running, we can't continue with automated tests
        console.log('❌ Server is not running. Please start the server with: npm start');
        console.log('   Then run this test again.');
        process.exit(1);
    }

    async testAuthentication() {
        console.log('\n🔐 Test 2: Authentication');
        
        try {
            const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });

            if (response.data.success && response.data.token) {
                this.authToken = response.data.token;
                console.log('✅ Authentication successful');
                this.testResults.authentication = true;
            } else {
                console.log('❌ Authentication failed: Invalid response');
            }
        } catch (error) {
            console.log('❌ Authentication failed:', error.response?.data?.message || error.message);
        }
    }

    async testContentFetching() {
        console.log('\n📖 Test 3: Content Fetching');
        
        try {
            // Test public endpoint (no auth required)
            const publicResponse = await axios.get(`${this.baseUrl}/api/content`);
            
            if (publicResponse.data.success && publicResponse.data.data) {
                console.log('✅ Public content fetch successful');
                
                const content = publicResponse.data.data;
                if (content.about_anume && content.privacy_policy) {
                    console.log('✅ Both content types present');
                    this.testResults.contentFetch = true;
                } else {
                    console.log('❌ Missing content types');
                }
            } else {
                console.log('❌ Public content fetch failed');
            }

            // Test admin endpoint (auth required)
            if (this.authToken) {
                const adminResponse = await axios.get(`${this.baseUrl}/api/content/admin/all`, {
                    headers: { Authorization: `Bearer ${this.authToken}` }
                });
                
                if (adminResponse.data.success) {
                    console.log('✅ Admin content fetch successful');
                } else {
                    console.log('❌ Admin content fetch failed');
                }
            }
        } catch (error) {
            console.log('❌ Content fetching failed:', error.response?.data?.message || error.message);
        }
    }

    async testContentUpdating() {
        console.log('\n✏️  Test 4: Content Updating');
        
        if (!this.authToken) {
            console.log('❌ Cannot test content updating without authentication');
            return;
        }

        try {
            const testContent = {
                title: 'Test About Anume',
                content: 'This is a test content update from the automated test suite.',
                content_type: 'plain_text'
            };

            const response = await axios.put(`${this.baseUrl}/api/content/about_anume`, testContent, {
                headers: { 
                    Authorization: `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                console.log('✅ Content update successful');
                this.testResults.contentUpdate = true;
                
                // Verify the update
                const verifyResponse = await axios.get(`${this.baseUrl}/api/content/about_anume`);
                if (verifyResponse.data.data.title === testContent.title) {
                    console.log('✅ Content update verified');
                } else {
                    console.log('❌ Content update verification failed');
                }
            } else {
                console.log('❌ Content update failed');
            }
        } catch (error) {
            console.log('❌ Content updating failed:', error.response?.data?.message || error.message);
        }
    }

    async testErrorHandling() {
        console.log('\n🛡️  Test 5: Error Handling');
        
        try {
            // Test invalid content key
            const invalidKeyResponse = await axios.get(`${this.baseUrl}/api/content/invalid_key`);
            console.log('❌ Should have failed for invalid key');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Invalid content key properly rejected');
                this.testResults.errorHandling = true;
            } else {
                console.log('❌ Unexpected error for invalid key:', error.message);
            }
        }

        // Test unauthorized update
        try {
            const response = await axios.put(`${this.baseUrl}/api/content/about_anume`, {
                title: 'Unauthorized Test',
                content: 'This should fail'
            });
            console.log('❌ Should have failed for unauthorized request');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Unauthorized request properly rejected');
            } else {
                console.log('❌ Unexpected error for unauthorized request:', error.message);
            }
        }
    }

    printResults() {
        console.log('\n📊 Test Results Summary');
        console.log('=' .repeat(60));
        
        const results = [
            ['Server Startup', this.testResults.serverStart],
            ['Authentication', this.testResults.authentication],
            ['Content Fetching', this.testResults.contentFetch],
            ['Content Updating', this.testResults.contentUpdate],
            ['Error Handling', this.testResults.errorHandling]
        ];

        let passedTests = 0;
        results.forEach(([testName, passed]) => {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${testName.padEnd(20)} ${status}`);
            if (passed) passedTests++;
        });

        console.log('=' .repeat(60));
        console.log(`Overall: ${passedTests}/${results.length} tests passed`);
        
        if (passedTests === results.length) {
            console.log('🎉 All tests passed! Content management system is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please check the implementation.');
        }

        console.log('\n📱 Manual Testing Instructions:');
        console.log('1. Open the admin panel at http://localhost:3000');
        console.log('2. Login with admin/admin123');
        console.log('3. Go to Content Management tab');
        console.log('4. Edit About Anume or Privacy Policy content');
        console.log('5. Open the Flutter app and check Settings > About Anume');
        console.log('6. Verify that content updates appear in real-time');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ContentManagementTester();
    tester.runTests().catch(console.error);
}

module.exports = ContentManagementTester;
