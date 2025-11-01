# Quantiv - Licensing System

This document explains how the licensing system works and how to manage customer licenses.

## Overview

Quantiv uses a customer-specific licensing system that:
- Binds licenses to specific customer information (name and email)
- Ties licenses to device fingerprints for security
- Prevents unauthorized distribution and sharing
- Allows license transfer between devices when needed

## How It Works

1. **Customer Purchase**: When a customer purchases the software, you generate a unique license key for them
2. **Installation**: Customer installs the application from the setup file
3. **Activation**: On first launch, the app prompts for license activation
4. **Device Binding**: Once activated, the license is bound to the customer's device
5. **Verification**: The app continuously verifies the license during use

## Generating License Keys

Use the license generator tool to create customer-specific license keys:

```bash
node tools/license-generator.js "Customer Name" "customer@email.com"
```

### Examples:

```bash
# English customer
node tools/license-generator.js "John Smith" "john@example.com"

# Arabic customer
node tools/license-generator.js "أحمد محمد" "ahmed@company.com"

# Company customer
node tools/license-generator.js "ABC Corporation" "info@abc-corp.com"
```

The tool will output:
- Customer information
- Generated license key (format: ABTK-XXXX-XXXX-XXXX-XXXX)
- Instructions for the customer

## Customer Activation Process

1. Customer installs the application
2. On first launch, an activation dialog appears
3. Customer enters:
   - License key (provided by you)
   - Email address (must match the one used to generate the key)
4. App validates the license and binds it to the device
5. Customer can now use the application

## License Features

### Device Binding
- Each license is tied to a unique device fingerprint
- Prevents sharing the same license across multiple devices
- Fingerprint includes: OS, CPU, hostname, and MAC address

### Clean Installation
- Each packaged app starts with a clean slate
- No development data, settings, or API keys
- Customer gets a fresh, default installation

### License Transfer
- Customers can request license transfers to new devices
- Transfer requests are logged for manual processing
- Old device license is deactivated when transfer is approved

## File Structure

```
├── main.js                           # Main Electron process with license logic
├── public/
│   ├── components/
│   │   └── LicenseActivation.js      # Activation dialog component
│   ├── utils/
│   │   ├── licenseManager.js         # Client-side license management
│   │   └── appCleaner.js             # Clean installation utility
│   └── app.js                        # App initialization with license check
├── tools/
│   └── license-generator.js          # License key generation tool
└── preload.js                        # IPC bridge for license operations
```

## Security Features

1. **Customer-Specific Keys**: Each key is unique to customer name and email
2. **Device Fingerprinting**: Prevents license sharing between devices
3. **Encrypted Storage**: License data is stored securely on device
4. **Tamper Detection**: License file integrity is verified
5. **Format Validation**: License keys follow strict format rules

## License States

- **Not Activated**: App requires activation on first launch
- **Activated**: License is valid and bound to current device
- **Invalid**: License key is malformed or incorrect
- **Device Mismatch**: License is bound to a different device
- **Expired**: License has expired (if expiration is implemented)

## Customer Support

### Common Issues:

1. **"Invalid license key"**
   - Check that the key is entered correctly
   - Ensure customer is using the exact email from purchase

2. **"License bound to another device"**
   - Customer needs to request license transfer
   - Deactivate old device license if accessible

3. **"Email mismatch"**
   - Customer must use the exact email used for purchase
   - Check for typos or different email addresses

### License Transfer Process:

1. Customer requests transfer through the app
2. Transfer request is logged with device information
3. Manually verify the request is legitimate
4. Generate new license for new device (if needed)
5. Deactivate old license

## Building and Distribution

1. **Build the installer**:
   ```bash
   .\tools\release-windows.ps1
   ```

2. **Distribute the installer**:
   - The `App Dist Windows` folder contains only the setup file
   - This setup file can be distributed to customers
   - Each customer needs their own unique license key

3. **Generate customer license**:
   ```bash
   node tools/license-generator.js "Customer Name" "customer@email.com"
   ```

4. **Provide to customer**:
   - Send the setup file
   - Send the license key
   - Include activation instructions

## Development vs Production

- **Development**: Licensing is disabled by default
- **Production**: Licensing is automatically enabled in packaged builds
- **Testing**: Set `requireLicense: true` in electron-store to test licensing in development

## Important Notes

- Keep the `LICENSE_SECRET` in `license-generator.js` secure
- Each customer must have a unique license key
- License keys are tied to customer information - changes require new keys
- The app will quit if no valid license is found in production builds
- Always test the licensing system before distributing to customers

## Troubleshooting

### Development Testing:
```javascript
// In main.js, temporarily set:
requireLicense: true  // Test licensing in development
```

### Reset License (for testing):
Delete the license file at: `%APPDATA%/Quantiv/license.dat`

### Check License Status:
The app logs license status to console during startup.
