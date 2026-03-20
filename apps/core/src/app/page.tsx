import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-4">dead-drop</h1>
        <p className="text-gray-400 text-xl mb-12">Privacy-focused, ephemeral snippet sharing</p>

        <div className="grid gap-6 mb-12">
          <Link
            href="/create"
            className="block bg-gray-900 rounded-lg p-8 border border-gray-800 hover:border-green-500 transition-colors text-left"
          >
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="text-green-500">+</span> Create Drop
            </h2>
            <p className="text-gray-400">
              Create a new encrypted drop. Choose protected (password required to read) or public
              (anyone can read).
            </p>
          </Link>

          <Link
            href="/view"
            className="block bg-gray-900 rounded-lg p-8 border border-gray-800 hover:border-blue-500 transition-colors text-left"
          >
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="text-blue-500">→</span> View Drop
            </h2>
            <p className="text-gray-400">
              Access an existing drop by name. Protected drops require a password.
            </p>
          </Link>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800 mb-8">
          <h3 className="text-lg font-semibold mb-4">How it works</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div>
              <div className="text-2xl mb-2">1️⃣</div>
              <p>Choose a unique drop name (min 12 chars)</p>
            </div>
            <div>
              <div className="text-2xl mb-2">2️⃣</div>
              <p>Add your content and set a password</p>
            </div>
            <div>
              <div className="text-2xl mb-2">3️⃣</div>
              <p>Share the URL - it self-destructs after expiry</p>
            </div>
          </div>
        </div>

        <div className="text-gray-600 text-sm">
          <p className="mb-1">Standard drops: Free, 10KB max, 7-day expiry, name ≥ 12 chars</p>
          <p>Deep drops: $?, 4MB max, 90-day expiry, name ≥ 3 chars</p>
        </div>
      </div>
    </main>
  );
}
