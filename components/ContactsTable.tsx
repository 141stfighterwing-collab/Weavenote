
import React from 'react';
import { Note } from '../types';

interface ContactsTableProps {
  contacts: Note[];
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

const ContactsTable: React.FC<ContactsTableProps> = ({ contacts, onEdit, onDelete }) => {
  // Helper to extract email/phone from markdown content content (basic regex)
  const extractContactInfo = (content: string) => {
      const emailMatch = content.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
      const phoneMatch = content.match(/(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      return {
          email: emailMatch ? emailMatch[0] : '',
          phone: phoneMatch ? phoneMatch[0] : ''
      };
  };

  const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`; 
  };

  if (contacts.length === 0) {
      return (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <span className="text-3xl">📇</span>
              <p className="mt-2 text-slate-500 dark:text-slate-400">No contacts found.</p>
          </div>
      );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name / Title</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Info</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {contacts.map((contact) => {
                    const info = extractContactInfo(contact.content);
                    return (
                        <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-slate-900 dark:text-white">{contact.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Added {new Date(contact.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                                    {contact.category}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                    {info.email && (
                                        <div className="flex items-center gap-1 mb-1">
                                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                            <a href={`mailto:${info.email}`} className="hover:underline hover:text-primary-600">{info.email}</a>
                                        </div>
                                    )}
                                    {info.phone && (
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            <span>{info.phone}</span>
                                        </div>
                                    )}
                                    {!info.email && !info.phone && <span className="text-slate-400 italic text-xs">No info extracted</span>}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {contact.tags.slice(0,3).map(tag => (
                                        <span 
                                            key={tag} 
                                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                                            style={{ backgroundColor: getHashColor(tag) }}
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                    {contact.tags.length > 3 && (
                                        <span className="text-xs text-slate-500 self-center">+{contact.tags.length - 3}</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => onEdit(contact)}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                    >
                                        Edit
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button 
                                        onClick={() => onDelete(contact.id)}
                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
          </table>
      </div>
    </div>
  );
};

export default ContactsTable;
