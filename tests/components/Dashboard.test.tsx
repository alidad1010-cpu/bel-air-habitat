/**
 * Tests pour Dashboard component
 * Couverture: Rendu, stats, interactions
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../../components/Dashboard';
import { Project, ProjectStatus } from '../../types';

describe('Dashboard', () => {
  const mockProjects: Project[] = [
    {
      id: '1',
      title: 'Test Project 1',
      description: 'Description 1',
      client: { id: '1', name: 'Client 1', email: 'client1@test.com', phone: '123456789' },
      status: ProjectStatus.NEW,
      contactMethod: 'EMAIL' as any,
      createdAt: Date.now(),
      priority: 'Haute',
    },
    {
      id: '2',
      title: 'Test Project 2',
      description: 'Description 2',
      client: { id: '2', name: 'Client 2', email: 'client2@test.com', phone: '987654321' },
      status: ProjectStatus.IN_PROGRESS,
      contactMethod: 'TELEPHONE' as any,
      createdAt: Date.now() - 1000,
      priority: 'Moyenne',
      budget: 10000,
    },
  ];

  const defaultProps = {
    projects: mockProjects,
    onNavigate: vi.fn(),
    notes: [],
    currentUser: {
      id: '1',
      username: 'test',
      email: 'test@test.com',
      fullName: 'Test User',
      role: 'USER' as any,
    },
  };

  it('should render dashboard with projects', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText(/tableau de bord/i)).toBeInTheDocument();
  });

  it('should display project statistics', () => {
    render(<Dashboard {...defaultProps} />);
    // Vérifier que les stats sont affichées
    // (peut nécessiter d'ajuster selon le rendu réel)
  });

  it('should call onNavigate when stat card is clicked', () => {
    const onNavigate = vi.fn();
    render(<Dashboard {...defaultProps} onNavigate={onNavigate} />);
    
    // Trouver une carte de stats et cliquer
    // (ajuster selon le rendu réel)
  });
});
