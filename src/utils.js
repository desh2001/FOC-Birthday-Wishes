import { getLocalImagePath } from './data.js';

export function calculateCountdown(birthdayStr) {
    if (!birthdayStr) return { days: 0, text: "Unknown", isToday: false };
    
    const parts = birthdayStr.split('/');
    if (parts.length !== 3) return { days: 0, text: "Invalid Date", isToday: false };
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let bdayThisYear = new Date(today.getFullYear(), month, day);
    bdayThisYear.setHours(0, 0, 0, 0);
    
    if (bdayThisYear.getTime() === today.getTime()) {
        return { days: 0, text: "Today!", isToday: true };
    }
    
    if (bdayThisYear < today) {
        bdayThisYear.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = Math.abs(bdayThisYear - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return { days: 1, text: "Tomorrow", isToday: false };
    return { days: diffDays, text: `In ${diffDays} Days`, isToday: false };
}

export function getThumbnailUrl(student) {
    if (!student) return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120";

    // 1. Prefer an explicitly saved local path (set when whatsapp-bot saves to public/img/)
    if (student.local_photo_path && student.local_photo_path.trim() !== '') {
        return student.local_photo_path;
    }

    // 2. Fall back to smart name-based matching against public/img/
    if (!student.photo_url || student.photo_url.trim() === '') {
        const localPath = getLocalImagePath(student);
        if (localPath) return localPath;
        return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"; // placeholder
    }
    
    const url = student.photo_url;
    
    // 3. Direct URLs (Firebase Storage, http, data URIs)
    if (url.startsWith('data:image') || (url.startsWith('http') && !url.includes('drive.google.com'))) {
        return url;
    }
    
    // 4. Google Drive → convert to direct-view URL
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
        }
    }
    
    return url;
}
