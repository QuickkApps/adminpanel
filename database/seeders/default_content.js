const { models } = require('../index');

const defaultContent = {
  about_anume: {
    title: 'About Anume',
    content: `A modern IPTV app built with Flutter that integrates with Xtream Codes API.

Features:
• Live TV streaming with EPG
• Movies (VOD) with metadata
• TV Series with episodes
• Catch-up TV functionality
• Favorites and continue watching

Version 1.0.0`,
    content_type: 'plain_text'
  },
  privacy_policy: {
    title: 'Privacy Policy',
    content: `This app stores your Xtream Codes credentials securely on your device using encrypted local storage. No personal data is transmitted to third parties except for the necessary communication with your IPTV provider's servers. Your viewing history and preferences are stored locally and are not shared with anyone. We respect your privacy and do not collect any analytics or tracking data.`,
    content_type: 'plain_text'
  }
};

async function seedDefaultContent() {
  try {
    console.log('🌱 Seeding default content...');
    
    for (const [key, data] of Object.entries(defaultContent)) {
      const existingContent = await models.AppContent.findOne({
        where: { content_key: key }
      });
      
      if (!existingContent) {
        await models.AppContent.create({
          content_key: key,
          title: data.title,
          content: data.content,
          content_type: data.content_type,
          is_active: true,
          version: 1,
        });
        console.log(`✅ Created default content for: ${key}`);
      } else {
        console.log(`ℹ️  Content already exists for: ${key}`);
      }
    }
    
    console.log('🌱 Default content seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding default content:', error);
    throw error;
  }
}

module.exports = { seedDefaultContent, defaultContent };
