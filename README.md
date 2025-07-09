# Configuration Guide: SFRA Store (Storefront Reference Architecture)

This guide will help you configure an SFRA store from scratch to develop payment method integrations in Salesforce Commerce Cloud.

## 📋 Prerequisites

- Node.js (version 18)
- npm (comes with Node.js, don't use another package manager)
- Git installed
- Access to a Salesforce Commerce Cloud instance
- Business Manager administrator permissions

## 🚀 Configuration Steps

### Step 1: Create Sandbox

Here you must log in with your Business Manager account and create the sandbox. **IMPORTANT: CREDITS ARE CONSUMED FROM THE MOMENT THE SANDBOX IS CREATED**. It's recommended to turn off the sandbox when not in use because it consumes fewer credits.

https://controlcenter.commercecloud.salesforce.com/realm?id=zytu

### Step 2: Get SFRA Source Code

You need to log in at https://github.com/orgs/SalesforceCommerceCloud/sso with your Business Manager account.

```bash
# Clone the official SFRA repository with https
git clone https://github.com/SalesforceCommerceCloud/storefront-reference-architecture.git
cd storefront-reference-architecture
```

### Step 3: Install Dependencies

```bash
# Install project dependencies
npm install

# Install sgmf-scripts globally (build tool)
npm install -g sgmf-scripts
```

### Step 4: Configure dw.json File

```bash
# Create configuration file (copy from example)
cp dw.json.example dw.json
```

Edit `dw.json` with your instance data:

```json
{
    "hostname": "your-instance.sandbox.us01.dx.commercecloud.salesforce.com",
    "username": "your-username",
    "password": "your-password",
    "code-version": "version1",
    "activate-code-version": true
}
```

### Step 5: Configure WebDAV and Certificates

```bash
# Install Prophet Debugger (official Salesforce tool)
npm install -g prophet-debugger

# Configure certificates for WebDAV
prophet-debugger --upload-cartridge
```

### Step 6: Compile and Upload Cartridges

```bash
# Compile the project
npm run compile:js
npm run compile:scss

# Upload cartridges to the instance
npm run uploadCartridge
```

### Step 7: Configure Store in Business Manager

#### 7.1 Access Business Manager
```
https://your-instance.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.store/Sites-Site
```

#### 7.2 Configure Cartridge Path
1. Go to `Administration > Sites > Manage Sites`
2. Select your site (e.g., "RefArch")
3. In the "Settings" tab, find "Cartridge Path"
4. Add: `int_handlerframework:app_storefront_base:lib_productlist`

#### 7.3 Configure Sample Data
1. Go to `Site Development > Import & Export`
2. Import the sample data included in SFRA
3. Files located in: `sites/RefArch/`

### Step 8: Verify Installation

```bash
# Run in development mode
npm run dev

# The store should be available at:
# https://your-instance.sandbox.us01.dx.commercecloud.salesforce.com/s/RefArch/
```

## 🔗 Useful Resources and Links

- **Official SFRA Repository:** https://github.com/SalesforceCommerceCloud/storefront-reference-architecture
- **SFRA Documentation:** https://documentation.b2c.commercecloud.salesforce.com/DOC1/index.jsp?topic=%2Fcom.demandware.dochelp%2Fcontent%2Fb2c_commerce%2Ftopics%2Fsfra%2Fb2c_sfra_setup.html
- **Official Installation Guide:** https://documentation.b2c.commercecloud.salesforce.com/DOC1/index.jsp?topic=%2Fcom.demandware.dochelp%2Fcontent%2Fb2c_commerce%2Ftopics%2Fsfra%2Fb2c_sfra_setup_project.html
- **Prophet Debugger:** https://github.com/SalesforceCommerceCloud/prophet
- **VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=SqrTT.prophet
- **Trailhead SFRA:** https://trailhead.salesforce.com/content/learn/modules/cc-digital-storefront-reference-architecture

## 🛠️ Common Troubleshooting

### WebDAV Certificate Error
```bash
# Verify that the certificate is installed correctly
prophet-debugger --upload-cartridge
```

### 404 Error When Accessing Store
- Verify that the cartridge path is configured correctly
- Verify that cartridges are uploaded and activated

### Compilation Error
```bash
# Verify Node.js version (should be 18)
node --version

# Clear cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules && npm install
```

### WebDAV Issues
- Verify credentials in `dw.json`
- Verify that the instance is active
- Verify user permissions

## ✅ Final Verification

Check each item when completed:

- [ ] SFRA store accessible from browser
- [ ] Sample data loaded correctly
- [ ] Cartridges uploaded and activated
- [ ] Development environment configured
- [ ] Prophet Debugger working
- [ ] Automatic compilation working
- [ ] WebDAV connected correctly

## 📝 Useful Commands

```bash
# Compile assets in development mode (watch)
npm run dev

# Compile for production
npm run build

# Upload cartridges
npm run uploadCartridge

# Clean build
npm run clean

# Run tests
npm test

# Check code with ESLint
npm run lint
```

## 🎯 Next Steps

Once you have the SFRA store configured, you can:

1. Explore the cartridge structure
2. Get familiar with controllers and templates
3. Start developing your payment method integration
4. Follow the main roadmap for complete integration

## 🆘 Support

If you encounter problems:

1. Consult official Salesforce documentation
2. Check logs in Business Manager
3. Use the Salesforce developer community
4. Check issues in the official SFRA repository

---

**Note:** This guide is based on the latest version of SFRA. Steps may vary slightly depending on the specific version of your Salesforce Commerce Cloud instance.
