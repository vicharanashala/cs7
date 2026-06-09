// Role-based sidebar navigation.
// IMPORTANT: This file reflects Change Spec §3 — `Recently Viewed` and `Yaksha Chatbot`
// are intentionally REMOVED from the student sidebar. The chatbot route still exists; only the
// nav entry is gone. The chatbot is reachable via the floating button in AppShell.
//
// Dashboard Spec updates the moderator and admin menus:
//  - Categories & Tags are moved INSIDE FAQ Management (no separate sidebar entries).
//  - Moderator: rename "Pending Answers" -> "Unresolved Questions"; remove Flagged FAQs,
//    Duplicate Candidates, Browse FAQs, and any redundant Unresolved Questions entry.
//  - Moderator FAQ access happens via the shared "FAQ Management" link.
//
// Search is removed from all sidebar nav — Unified Search now lives in the topbar.
import {
  Bookmark,
  BookOpen,
  Home,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  Bot,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@samagama/shared';

export interface NavItem {
  /** Optional section heading rendered above this item. */
  section?: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Optional badge (count or label). */
  badge?: string;
}

const studentNav: NavItem[] = [
  { section: 'Main', label: 'Home', path: '/', icon: Home },
  { label: 'Browse FAQs', path: '/faqs', icon: BookOpen },
  { label: 'Community Q&A', path: '/community', icon: MessageCircle },
  { section: 'My Activity', label: 'Ask a Question', path: '/ask', icon: MessageSquarePlus },
  { label: 'My Questions', path: '/my-questions', icon: Bookmark },
];

const moderatorNav: NavItem[] = [
  { section: 'Moderation', label: 'Dashboard', path: '/moderation', icon: LayoutDashboard },
  {
    label: 'Unresolved Questions',
    path: '/moderation/unresolved',
    icon: MessageSquare,
  },
  { section: 'Knowledge', label: 'FAQ Management', path: '/admin/faqs', icon: BookOpen },
  { label: 'Chatbot Feedback', path: '/admin/bot-feedback', icon: Bot },
];

const adminNav: NavItem[] = [
  { section: 'Overview', label: 'Admin Overview', path: '/admin', icon: LayoutDashboard },
  { section: 'Knowledge', label: 'FAQ Management', path: '/admin/faqs', icon: BookOpen },
  { section: 'People', label: 'User Management', path: '/admin/users', icon: Users },
  {
    section: 'System',
    label: 'Unresolved Questions',
    path: '/moderation/unresolved',
    icon: MessageSquare,
  },
  { label: 'Chatbot Feedback', path: '/admin/bot-feedback', icon: Bot },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

// Trainee roles share the full menu of the role they temporarily impersonate:
// t-moderator → moderator menu, t-admin → admin menu.
export const navByRole: Record<UserRole, NavItem[]> = {
  student: studentNav,
  't-moderator': moderatorNav,
  moderator: moderatorNav,
  't-admin': adminNav,
  admin: adminNav,
};
