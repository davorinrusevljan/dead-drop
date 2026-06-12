import Link from 'next/link';
import { getPostBySlug, getPostSlugs } from '../../../lib/blog';
import '../blog.css';
import type { Metadata } from 'next';

export function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return {
    title: `${post.title} — dead-drop.xyz`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      url: `https://dead-drop.xyz/blog/${post.slug}`,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  return (
    <>
      <header className="page-header">
        <a href="/">dead-drop.xyz</a>
      </header>
      <main className="main-container">
        <div className="blog-container animate-fade-in-up blog-post">
          <Link href="/blog" className="blog-post-back">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          <div className="blog-post-header">
            <h1>{post.title}</h1>
            <div className="blog-post-meta">
              <span className="date">{post.date}</span>
              <span>by {post.author}</span>
            </div>
          </div>

          <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
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
