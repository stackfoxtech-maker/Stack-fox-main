import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { BookOpen, Search } from 'lucide-react';

const terms = [
  { term: 'API', def: 'Application Programming Interface — a set of rules that allows software applications to communicate with each other.' },
  { term: 'Agile', def: 'An iterative approach to project management and software development that delivers work in small increments.' },
  { term: 'AWS', def: 'Amazon Web Services — a cloud computing platform offering infrastructure, storage, and managed services.' },
  { term: 'CI/CD', def: 'Continuous Integration / Continuous Deployment — automating code integration, testing, and release processes.' },
  { term: 'CLI', def: 'Command Line Interface — a text-based interface for interacting with software or operating systems.' },
  { term: 'CMS', def: 'Content Management System — software for creating and managing digital content without writing code.' },
  { term: 'CORS', def: 'Cross-Origin Resource Sharing — a browser mechanism that allows controlled access to resources from another domain.' },
  { term: 'DNS', def: 'Domain Name System — translates human-readable domain names to IP addresses.' },
  { term: 'Docker', def: 'A platform for building, shipping, and running applications in lightweight, portable containers.' },
  { term: 'Frontend', def: 'The client-side part of an application that users interact with directly in their browser.' },
  { term: 'Git', def: 'A distributed version control system for tracking changes in source code during development.' },
  { term: 'GraphQL', def: 'A query language for APIs that lets clients request exactly the data they need.' },
  { term: 'HTTP', def: 'HyperText Transfer Protocol — the foundation protocol for data communication on the web.' },
  { term: 'IDE', def: 'Integrated Development Environment — a software suite with tools for writing, testing, and debugging code.' },
  { term: 'JWT', def: 'JSON Web Token — a compact, URL-safe token used for securely transmitting information between parties.' },
  { term: 'Kubernetes', def: 'An open-source platform for automating deployment, scaling, and management of containerized applications.' },
  { term: 'Microservices', def: 'An architectural style where an application is composed of small, independently deployable services.' },
  { term: 'MVP', def: 'Minimum Viable Product — the simplest version of a product that delivers core value to early users.' },
  { term: 'OAuth', def: 'An authorization framework that allows third-party services to access user data without exposing credentials.' },
  { term: 'ORM', def: 'Object-Relational Mapping — a technique that lets you interact with a database using objects instead of SQL.' },
  { term: 'REST', def: 'Representational State Transfer — an architectural style for designing networked APIs using HTTP methods.' },
  { term: 'SaaS', def: 'Software as a Service — cloud-hosted software accessed via subscription rather than local installation.' },
  { term: 'SDK', def: 'Software Development Kit — a collection of tools, libraries, and documentation for building on a platform.' },
  { term: 'SEO', def: 'Search Engine Optimization — techniques to improve a website\'s visibility in search engine results.' },
  { term: 'SQL', def: 'Structured Query Language — the standard language for managing and querying relational databases.' },
  { term: 'SSL/TLS', def: 'Secure Sockets Layer / Transport Layer Security — cryptographic protocols that secure internet communications.' },
  { term: 'TypeScript', def: 'A typed superset of JavaScript that compiles to plain JavaScript, adding static type checking.' },
  { term: 'UI/UX', def: 'User Interface / User Experience — the visual design and overall experience of interacting with a product.' },
  { term: 'WebSocket', def: 'A protocol providing full-duplex communication channels over a single TCP connection.' },
  { term: 'Webhook', def: 'An HTTP callback that sends real-time data to other applications when a specific event occurs.' },
];

export default function Glossary() {
  usePageTitle('IT Glossary');
  const [query, setQuery] = useState('');

  const filtered = terms.filter((t) => t.term.toLowerCase().includes(query.toLowerCase()) || t.def.toLowerCase().includes(query.toLowerCase()));
  const letters = [...new Set(filtered.map((t) => t.term[0]))].sort();

  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <BookOpen className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">IT Glossary</h1>
        <p className="text-warm-600">Quick reference for common technology terms.</p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400" />
        <input placeholder="Search terms..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full border border-warm-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
      </div>

      {letters.map((l) => (
        <div key={l} className="mb-6">
          <div className="text-xs font-bold text-fox-500 uppercase tracking-widest mb-2">{l}</div>
          <div className="space-y-2">
            {filtered.filter((t) => t.term[0] === l).map((t) => (
              <div key={t.term} className="bg-white rounded-2xl border border-warm-200 p-4">
                <span className="font-semibold text-warm-900">{t.term}</span>
                <p className="text-sm text-warm-600 mt-1">{t.def}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <p className="text-center text-warm-400 py-12">No matching terms found.</p>}
    </div>
  );
}
