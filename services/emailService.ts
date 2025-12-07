import { Client, Project, PurchaseOrder } from '../types';

export const generateQuoteEmailLink = (client: Client, project: Project) => {
    const subject = encodeURIComponent(`Devis pour votre projet : ${project.title}`);
    const body = encodeURIComponent(`Bonjour ${client.name},

Veuillez trouver ci-joint le devis pour votre projet "${project.title}".

Nous restons à votre disposition pour toute question.

Cordialement,
L'équipe Bel Air Habitat`);

    return `mailto:${client.email}?subject=${subject}&body=${body}`;
};

export const generateWorkOrderEmailLink = (subcontractorEmail: string, order: PurchaseOrder, project: Project) => {
    const subject = encodeURIComponent(`Bon de Commande N°${order.number} - ${project.title}`);
    const body = encodeURIComponent(`Bonjour,

Veuillez trouver ci-joint le Bon de Commande N°${order.number} pour le chantier :
${project.title}

Dates d'intervention : du ${order.startDate ? new Date(order.startDate).toLocaleDateString() : '...'} au ${order.endDate ? new Date(order.endDate).toLocaleDateString() : '...'}.

Merci de nous confirmer la bonne réception et votre disponibilité.

Cordialement,
Service Travaux - Bel Air Habitat`);

    return `mailto:${subcontractorEmail}?subject=${subject}&body=${body}`;
};
