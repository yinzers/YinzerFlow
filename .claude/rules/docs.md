# Documentation Standards for YinzerFlow

<!-- Documentation guidelines for YinzerFlow framework -->

When creating or updating documentation, follow this template to ensure consistency, clarity, and completeness.

## Documentation Template

```markdown
# 📖 Overview

When to use this and expected outcomes. Link to configuration patterns.

# ⚙️ Usage

## 🎛️ Settings (Use when applicable)

### settingName — @default <span style="color: #2ecc71">`value`</span>

Small description of setting

```typescript
// example code
```

<aside>

Options (If applicable): `<options type>`

- Option 1: description of option and or example
</aside>

**When to use Settings section:**
- **Configuration options**: When the feature has configurable settings/options
- **Framework features**: Rate limiting, CORS, body parsing, logging, etc.
- **User-controlled behavior**: Settings that developers can modify

**When NOT to use Settings section:**
- **Core objects**: Context, Request, Response objects (use "Usage" instead)
- **API methods**: Route methods, response methods (use "Usage" instead)
- **Built-in behavior**: Automatic features with no configuration (use "Usage" instead)

**Alternative approach for non-configurable features:**
```markdown
# ⚙️ Usage

## 🔧 Basic Usage

Description of how to use the feature

```typescript
// example code
```

## 🎯 Advanced Usage

More complex usage patterns

```typescript
// example code
```
```

# ✨ Best Practices

-

# 💻 Examples

### Production API

**Use Case:** (Fill in)

**Description:** (Fill in)

```typescript
// Example Code Block
```

### Dev API

**Use Case:** (Fill in)

**Description:** (Fill in)

```typescript
// Example Code Block
```

## 🚀 Performance Notes (If applicable)

Limits, memory considerations, trade-offs.

## 🔒 Security Notes (If applicable)

Use 🛡️ emoji for security features:

### 🛡️ [Security Feature Name]
- **Problem**: Description of the security issue
- **YinzerFlow Solution**: How we solve it

## 🔧 Troubleshooting

Misconfiguration symptoms and fixes.
```

## Writing Standards

### **Essential Rules**
- **Follow the template**: Use the exact structure shown above
- **TypeScript only**: All code examples with proper types (```typescript)
- **Runnable examples**: Every code block should be copy-pasteable and functional
- **Production vs Dev**: Show both production-ready and development configurations
- **Security with 🛡️**: Use emoji for security features in Problem/Solution format
- **Progressive complexity**: Start simple (Dev API), progress to complex (Production API)
- **Use section emojis**: Add emojis to section headers for visual engagement
- **Add color highlights**: Use HTML color spans for important callouts (GitHub-compatible)

### **Terminology**
- Use "YinzerFlow" (not "yinzerflow" or "Yinzer Flow")
- Use "configuration" (not "config" in formal docs)
- Use "TypeScript" (not "TS") and "JavaScript" (not "JS")

### **Tone**
- Professional but friendly
- Confident - highlight YinzerFlow's strengths
- Helpful - focus on solving developer problems

## Color Standards

Use HTML color spans for emphasis (works in GitHub markdown):

### **Color Palette**

```markdown
<span style="color: #2ecc71">Green text for success, enabled, recommended</span>
<span style="color: #e74c3c">Red text for errors, disabled, warnings</span>
<span style="color: #3498db">Blue text for info, notes, tips</span>
<span style="color: #f39c12">Orange text for caution, important</span>
<span style="color: #9b59b6">Purple text for advanced, optional</span>
<span style="color: #95a5a6">Gray text for deprecated, legacy</span>
```

### **When to Use Colors**

- **Green (#2ecc71)**: Default settings, recommended options, best practices
- **Red (#e74c3c)**: Required fields, critical warnings, errors
- **Blue (#3498db)**: Helpful tips, informational notes, references
- **Orange (#f39c12)**: Caution, important considerations, performance notes
- **Purple (#9b59b6)**: Advanced features, optional enhancements
- **Gray (#95a5a6)**: Deprecated features, legacy support

### **Color Usage Examples**

```markdown
### enabled — @default <span style="color: #2ecc71">`true`</span>

<span style="color: #e74c3c">**⚠️ Warning:**</span> Disabling rate limiting removes DoS protection.

<span style="color: #3498db">**💡 Tip:**</span> Use custom key generators for authenticated APIs.

<span style="color: #f39c12">**⚡ Performance:**</span> High limits may increase memory usage.

<span style="color: #9b59b6">**🔮 Advanced:**</span> Implement custom strategies for complex scenarios.
```

## Emoji Standards

Use emojis consistently across all documentation to improve visual hierarchy and engagement.

### **Section Header Emojis**

```markdown
# 📖 Overview
# ⚙️ Usage
## 🎛️ Settings
# ✨ Best Practices
# 💻 Examples
## 🚀 Performance Notes
## 🔒 Security Notes
## 🔧 Troubleshooting
```

### **Inline Emojis**

```markdown
✅ Correct / Recommended
❌ Incorrect / Not recommended
⚠️ Warning / Caution
💡 Tip / Information
⚡ Performance note
🔮 Advanced feature
🎯 Use case / Goal
📝 Note / Documentation
🔗 Link / Reference
🛡️ Security feature
🚨 Critical / Required
🎨 Customization option
📊 Example / Demo
🔄 Related / See also
⏱️ Time-related
💾 Memory-related
🌐 Network-related
🔑 Authentication-related
```

### **Status & State Emojis**

```markdown
🟢 Enabled / Active / Success
🔴 Disabled / Inactive / Error
🟡 Warning / Caution
🔵 Info / Note
⚪ Neutral / Default
```

### **Emoji Usage Rules**

1. **One emoji per header**: Don't overuse - keeps it clean
2. **Consistent mapping**: Same emoji for same concept across all docs
3. **After header text**: Place emoji at the start of headers for visual scanning
4. **Inline sparingly**: Use inline emojis only for important callouts
5. **Accessibility**: Always include descriptive text, don't rely on emoji alone

## Example Sections

### Example: Security Notes Section

```markdown
## 🔒 Security Notes

YinzerFlow implements several security measures to prevent common vulnerabilities:

### 🛡️ Input Validation
- **Problem**: Malicious input can cause security vulnerabilities
- **YinzerFlow Solution**: All inputs are validated against strict schemas with configurable limits

### 🛡️ Rate Limiting
- **Problem**: Abuse and DoS attacks through unlimited requests
- **YinzerFlow Solution**: Built-in rate limiting with configurable thresholds (enabled by default)

### 🛡️ Prototype Pollution Protection
- **Problem**: JSON parsing can modify object prototypes, leading to security vulnerabilities
- **YinzerFlow Solution**: Secure JSON parsing that blocks prototype properties by default

These security measures ensure YinzerFlow follows security best practices and prevents common attack vectors.
```

### Example: Settings Section

```markdown
## 🎛️ Settings

### maxSize — @default <span style="color: #2ecc71">`262144`</span> (256KB)

Maximum JSON request body size in bytes. Protects against DoS attacks through large payloads.

```typescript
const app = new YinzerFlow({
  bodyParser: {
    json: {
      maxSize: 524288 // 512KB
    }
  }
});
```

<aside>

Limits: `number` (in bytes)

- Minimum: `1024` (1KB)
- Recommended: `262144` (256KB) for APIs
- Maximum: Depends on use case, but avoid values over 10MB
</aside>
```

### Example: Examples Section

```markdown
# 💻 Examples

### Production API

**Use Case:** Secure API with rate limiting and custom error handling

**Description:** Production-ready configuration with rate limiting, CORS, and comprehensive error handling for a public-facing API.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  rateLimit: {
    enabled: true,
    windowMs: 900000, // 15 minutes
    max: 100 // 100 requests per window
  },
  cors: {
    enabled: true,
    origin: ['https://app.example.com'],
    credentials: true
  }
});

app.get('/api/users', async ({ request, response }) => {
  // Your handler logic
  return { users: [] };
});

await app.listen();
```

### Dev API

**Use Case:** Development server with relaxed CORS and verbose logging

**Description:** Development configuration with permissive CORS, detailed logging, and disabled rate limiting for easier debugging.

```typescript
import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow({
  port: 3000,
  networkLogs: true,
  rateLimit: {
    enabled: false // Disable for development
  },
  cors: {
    enabled: true,
    origin: true, // Allow all origins
    credentials: true
  }
});

app.get('/api/test', async () => {
  return { message: 'Development mode' };
});

await app.listen();
```
```

## Quick Checklist

- [ ] Follows template structure (📖 Overview → ⚙️ Usage → ✨ Best Practices → 💻 Examples → 🚀 Performance Notes → 🔒 Security Notes → 🔧 Troubleshooting)
- [ ] All section headers have appropriate emojis
- [ ] Default values highlighted in <span style="color: #2ecc71">green</span>
- [ ] Warnings/cautions use <span style="color: #e74c3c">red</span> or <span style="color: #f39c12">orange</span>
- [ ] Tips use <span style="color: #3498db">blue</span> with 💡 emoji
- [ ] All code examples use TypeScript with proper types
- [ ] Includes Production and Dev examples
- [ ] Security features use 🛡️ emoji with Problem/Solution format
- [ ] Uses correct terminology (YinzerFlow, TypeScript, configuration)
- [ ] Professional but friendly tone
- [ ] All examples are tested and runnable
