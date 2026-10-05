const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const componentReplacements = {
  'FetchInterceptor': '@/lib/FetchInterceptor',
  'ToastProvider': '@/components/shared/ToastProvider',
  'InteractiveShopMap': '@/components/shared/InteractiveShopMap',
  'NotificationBell': '@/components/shared/NotificationBell',
  'PrivacyModal': '@/components/shared/PrivacyModal',
  'StartupLoader': '@/components/shared/StartupLoader',
  'TermsModal': '@/components/shared/TermsModal',
  'UnifiedDateRangePicker': '@/components/shared/UnifiedDateRangePicker'
};

const utilReplacements = {
  'formatters': '@/utils/formatters',
  'cropImage': '@/utils/cropImage'
};

walkDir(directoryPath, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Replace component imports
    Object.keys(componentReplacements).forEach(comp => {
      const regex = new RegExp(`['"](?:\\.[\\./\\w-]*)?components\\/${comp}['"]`, 'g');
      content = content.replace(regex, `'${componentReplacements[comp]}'`);
    });

    // Replace util imports
    Object.keys(utilReplacements).forEach(util => {
      const regex = new RegExp(`['"](?:\\.[\\./\\w-]*)?utils\\/${util}['"]`, 'g');
      content = content.replace(regex, `'${utilReplacements[util]}'`);
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated imports in ${filePath}`);
    }
  }
});
