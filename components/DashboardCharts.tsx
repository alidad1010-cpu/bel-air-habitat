/**
 * DashboardCharts - Graphiques pour le Dashboard
 * Utilise recharts pour afficher les graphiques
 */
import React, { useMemo } from 'react';
import { Project, ProjectStatus } from '../types';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardChartsProps {
  projects: Project[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ projects }) => {
  // Calculer les données pour les graphiques
  const monthlyRevenue = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = new Date().getFullYear();
    const revenueByMonth = new Array(12).fill(0);

    projects.forEach((project) => {
      if (project.status === ProjectStatus.COMPLETED && project.budget) {
        const completedDate = project.closureDate 
          ? new Date(project.closureDate) 
          : new Date(project.updatedAt || project.createdAt);
        
        if (completedDate.getFullYear() === currentYear) {
          const month = completedDate.getMonth();
          revenueByMonth[month] += project.budget || 0;
        }
      }
    });

    return months.map((month, index) => ({
      month,
      revenue: Math.round(revenueByMonth[index]),
    }));
  }, [projects]);

  const projectStatusDistribution = useMemo(() => {
    const statusCount: Record<string, number> = {};
    Object.values(ProjectStatus).forEach((status) => {
      statusCount[status] = projects.filter((p) => p.status === status).length;
    });

    return Object.entries(statusCount)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.replace('_', ' '),
        value: count,
      }));
  }, [projects]);


  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  // Vérifier si les graphiques ont des données à afficher
  const hasRevenueData = monthlyRevenue.some((item) => item.revenue > 0);
  const hasStatusData = projectStatusDistribution.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graphique CA Mensuel */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
          CA Mensuel {new Date().getFullYear()}
        </h3>
        {hasRevenueData ? (
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#64748b' }}
                  className="text-slate-600 dark:text-slate-400" 
                />
                <YAxis 
                  tick={{ fill: '#64748b' }}
                  className="text-slate-600 dark:text-slate-400" 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="CA (€)"
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
            <p className="text-sm">Aucune donnée de CA disponible pour {new Date().getFullYear()}</p>
          </div>
        )}
      </div>

      {/* Répartition des Projets par Statut */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Répartition des Projets
        </h3>
        {hasStatusData ? (
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent?: number }) => 
                `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`
              }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {projectStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
            <p className="text-sm">Aucun projet à afficher</p>
          </div>
        )}
      </div>
    </div>
  );
};
