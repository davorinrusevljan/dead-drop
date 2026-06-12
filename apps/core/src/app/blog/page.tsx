import Link from 'next/link';
import { getAllPosts } from '../../lib/blog';
import './blog.css';

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <>
      <header className="page-header">
        <a href="/">dead-drop.xyz</a>
      </header>
      <main className="main-container">
        <div className="blog-container animate-fade-in-up">
          <div className="blog-header">
            <h1>Blog</h1>
            <p>Updates, technical deep-dives, and announcements from dead-drop.</p>
          </div>

          {posts.length === 0 ? (
            <div className="blog-empty">No posts yet. Check back soon.</div>
          ) : (
            <div className="blog-list">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-card-meta">
                    <span className="blog-card-date">{post.date}</span>
                    <span>by {post.author}</span>
                  </div>
                  <h2>{post.title}</h2>
                  <p>{post.description}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
        <footer className="footer">
          <nav className="footer-nav">
            <a href="/how-it-works">How It Works</a>
            <a href="/gallery">Gallery</a>
            <a href="/glossary">Glossary</a>
            <a href="/faq">F.A.Q.</a>
            <a href="/blog">Blog</a>
            <a href="/terms">Terms of Service</a>
            <a
              href="https://davorinrusevljan.github.io/dead-drop/latest/"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Documentation
            </a>
            <a
              href="https://github.com/davorinrusevljan/dead-drop"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
          <span style={{ opacity: 0.7 }}>
            ©{' '}
            <a
              href="https://ghostgrammer.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              ghostgrammer.xyz
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
