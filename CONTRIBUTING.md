# Contributing to Anume VPN Admin Panel

Thank you for your interest in contributing to the Anume VPN Admin Panel! We welcome contributions from the community and are grateful for any help you can provide.

## 🤝 How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, please include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node.js version, browser)
- **Error messages** or logs

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear title and description** of the enhancement
- **Use case** - explain why this would be useful
- **Detailed explanation** of how it should work
- **Mockups or examples** if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for any new functionality
4. **Update documentation** if needed
5. **Ensure tests pass** by running `npm test`
6. **Create a pull request** with a clear title and description

## 🛠️ Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### Local Development

1. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/adminpanel.git
   cd adminpanel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Initialize database**
   ```bash
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Run tests**
   ```bash
   npm test
   ```

## 📝 Coding Standards

### JavaScript Style Guide

- Use **ES6+** features where appropriate
- Follow **camelCase** for variables and functions
- Use **PascalCase** for classes and constructors
- Use **UPPER_SNAKE_CASE** for constants
- Add **JSDoc comments** for functions and classes
- Keep functions **small and focused**
- Use **meaningful variable names**

### Code Formatting

- Use **2 spaces** for indentation
- Use **semicolons** at the end of statements
- Use **single quotes** for strings
- Keep lines under **100 characters**
- Add trailing commas in objects and arrays

### Example:

```javascript
/**
 * Creates a new user with validation
 * @param {Object} userData - User data object
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @returns {Promise<Object>} Created user object
 */
const createUser = async (userData) => {
  const { username, email } = userData;
  
  if (!username || !email) {
    throw new Error('Username and email are required');
  }
  
  return await User.create({
    username,
    email,
    createdAt: new Date(),
  });
};
```

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for **all new functionality**
- Use **descriptive test names**
- Follow **AAA pattern** (Arrange, Act, Assert)
- Mock external dependencies
- Test both **success and error cases**

### Test Structure

```javascript
describe('User Management', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com'
      };
      
      // Act
      const result = await createUser(userData);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
    });
    
    it('should throw error with invalid data', async () => {
      // Arrange
      const invalidData = { username: 'test' }; // missing email
      
      // Act & Assert
      await expect(createUser(invalidData)).rejects.toThrow('Username and email are required');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- user.test.js
```

## 📚 Documentation

### Code Documentation

- Add **JSDoc comments** for all public functions
- Include **parameter types** and **return types**
- Provide **usage examples** for complex functions
- Document **error conditions** and **exceptions**

### README Updates

When adding new features:

- Update the **Features** section
- Add **configuration examples** if needed
- Update **API documentation** section
- Add **usage examples**

## 🔄 Git Workflow

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(auth): add JWT token refresh mechanism
fix(chat): resolve message ordering issue
docs(api): update fallback URL endpoints documentation
test(users): add integration tests for user management
```

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md` with new changes
3. Run full test suite
4. Create release branch
5. Submit pull request for review
6. Merge to main after approval
7. Create GitHub release with tag
8. Deploy to production

## 🎯 Areas for Contribution

We especially welcome contributions in these areas:

### High Priority
- **Performance optimizations**
- **Security enhancements**
- **Test coverage improvements**
- **Documentation updates**
- **Bug fixes**

### Medium Priority
- **New features** (discuss first in issues)
- **UI/UX improvements**
- **Code refactoring**
- **Accessibility improvements**

### Low Priority
- **Code style improvements**
- **Minor optimizations**
- **Additional logging**

## 📞 Getting Help

If you need help with contributing:

1. **Check existing issues** and discussions
2. **Create a new issue** with the `question` label
3. **Join our discussions** on GitHub
4. **Review the documentation** in the `/docs` folder

## 🏆 Recognition

Contributors will be:

- **Listed in the README** contributors section
- **Mentioned in release notes** for significant contributions
- **Invited to join** the core team for outstanding contributions

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

---

Thank you for contributing to the Anume VPN Admin Panel! 🎉
