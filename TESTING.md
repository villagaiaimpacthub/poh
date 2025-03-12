# Testing Guide for Proof of Humanity

This document outlines the testing strategy and procedures for the Proof of Humanity application.

## Testing Philosophy

Our testing approach focuses on:

1. **Comprehensive Coverage**: Testing all critical functionality including the database layer, API endpoints, WebRTC features, and security.
2. **Automated Testing**: Utilizing pytest for automated testing to ensure consistent results.
3. **Test-Driven Development**: Writing tests before implementing features when possible.
4. **Continuous Integration**: Running tests automatically on each PR and commit to main branch.

## Setting Up the Test Environment

### Prerequisites

- Python 3.8 or higher
- pip
- virtualenv or venv (recommended)

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/your-org/proof-of-humanity.git
   cd proof-of-humanity
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

3. Install the required dependencies including test dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Install pre-commit hooks (optional but recommended):
   ```bash
   pre-commit install
   ```

## Running Tests

We've provided a convenient script to run tests with various options.

### Basic Test Run

To run all tests:

```bash
./run_tests.py
```

### Options

The test runner supports several options:

- `--verbose` or `-v`: Display verbose output
- `--coverage` or `-c`: Generate coverage report
- `--html`: Generate HTML coverage report (use with `--coverage`)
- `--module` or `-m`: Run tests for a specific module (e.g., api, database)
- `--failfast` or `-f`: Stop on first test failure

Examples:

```bash
# Run tests with verbose output
./run_tests.py -v

# Run tests with coverage report
./run_tests.py -c

# Run tests with HTML coverage report
./run_tests.py -c --html

# Run only database tests
./run_tests.py -m database

# Run only API tests with coverage
./run_tests.py -m api -c
```

### Running Individual Test Files

You can also run individual test files directly with pytest:

```bash
pytest tests/test_api.py -v
```

## Test Categories

Our test suite is organized into the following categories:

### 1. Database Tests

Tests database operations, connection pooling, and transaction management.

- File: `tests/test_database.py`
- Run with: `./run_tests.py -m database`

### 2. API Tests

Tests all API endpoints, focusing on input validation, output format, and error handling.

- File: `tests/test_api.py`
- Run with: `./run_tests.py -m api`

### 3. WebRTC Tests

Tests WebRTC functionality including session management and signaling.

- File: `tests/test_webrtc.py`
- Run with: `./run_tests.py -m webrtc`

### 4. Security Tests

Tests authentication, authorization, and protection against common web vulnerabilities.

- File: `tests/test_security.py`
- Run with: `./run_tests.py -m security`

## Writing New Tests

When adding new features, please follow these guidelines for writing tests:

1. **Test File Location**: Place tests in the `tests/` directory with a name that reflects what's being tested (`test_*.py`).
2. **Test Naming**: Name test functions with `test_` prefix followed by a descriptive name (e.g., `test_user_registration`).
3. **Fixtures**: Use pytest fixtures for setup and teardown when possible.
4. **Mocking**: Use `unittest.mock` for mocking external dependencies.
5. **Assertions**: Use pytest's built-in assertions for clear error messages.

Example:

```python
def test_user_registration(client):
    """Test user registration with valid data."""
    response = client.post('/register', 
                          data={
                              'username': 'newuser',
                              'email': 'new@example.com',
                              'password': 'securepassword',
                              'confirm_password': 'securepassword'
                          })
    
    assert response.status_code == 200
    assert b'Registration successful' in response.data
```

## Continuous Integration

Our CI pipeline automatically runs tests on:

1. Every pull request to the main branch
2. Every direct commit to the main branch

The CI configuration ensures:

- All tests pass
- Code coverage does not decrease
- Linting checks pass

## Coverage Goals

We aim for the following test coverage:

- **Core functionality**: 90%+ coverage
- **API endpoints**: 100% coverage
- **Database operations**: 90%+ coverage
- **Security features**: 100% coverage
- **Overall project**: At least 80% coverage

Current coverage reports can be generated with:

```bash
./run_tests.py -c --html
```

Then open `htmlcov/index.html` in your browser to view the report.

## Troubleshooting Common Test Issues

### Tests Fail with Database Errors

Make sure you're not using a production database for tests. The tests should use an in-memory SQLite database by default.

### Failing WebRTC Tests

WebRTC tests may fail if your environment doesn't support the necessary dependencies. Make sure you have the required libraries installed.

### Mock Objects Not Working

When using mocks, ensure you're patching the correct path. The path should be where the object is used, not where it's defined.

## Future Improvements

- Add more integration tests that test multiple components together
- Implement UI testing with Selenium or similar tools
- Add performance benchmarks for critical operations

## Questions and Support

If you have questions about testing or encounter issues, please reach out to the development team or open an issue on GitHub. 