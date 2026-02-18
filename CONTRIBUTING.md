# Contributing to YCode

Thanks for your interest in contributing to YCode! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account (for deployment) or local development

### Local Development

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/ycode.git
   cd ycode
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and fill in your Supabase credentials:

   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3002](http://localhost:3002) in your browser.

### Database Migrations

To run pending migrations:

```bash
npm run migrate:latest
```

To create a new migration:

```bash
npm run migrate:make -- migration_name
```

## Making Changes

1. Create a new branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and ensure they pass linting and type checks:

   ```bash
   npm run lint
   npm run type-check
   ```

3. Commit your changes following our commit conventions:

   ```
   feat: add new feature
   fix: resolve specific bug
   refactor: restructure without behavior change
   chore: maintenance or dependency update
   docs: documentation only
   ```

   Use imperative mood, lowercase after the type prefix, and keep the subject line under 50 characters.

4. Push your branch and open a pull request.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear summary of what changed and why
- Add a test plan describing how to verify the changes
- Link related issues when applicable

## Reporting Bugs

- Use [GitHub Issues](https://github.com/ycode/ycode/issues) to report bugs
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser and OS information if relevant

## Requesting Features

- Open a [Discussion](https://github.com/ycode/ycode/discussions) to propose new features
- Describe the use case and why it would be valuable

## Code Style

- TypeScript throughout — no `any` types unless absolutely necessary
- Functional components with hooks for React
- Tailwind CSS for styling
- The pre-commit hook runs ESLint and type checking automatically

## License

By contributing to YCode, you agree that your contributions will be licensed under the [MIT License](LICENSE).
