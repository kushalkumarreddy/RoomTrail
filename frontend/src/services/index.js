/**
 * RoomTrail API Service Layer Barrel Export
 */

export { default as apiClient } from './api';
export { userService } from './userService';
export { propertyService } from './propertyService';
export { tripService } from './tripService';
export { visitService } from './visitService';
export { routePointService } from './routePointService';
export { tripSummaryService } from './tripSummaryService';
export { routingService } from './routingService';
export { geocodingService } from './geocodingService';

// Aliases for seamless backward compatibility
export { authService } from './authService';
export { adminService } from './adminService';
export { trackingService } from './trackingService';
export { inspectionService } from './inspectionService';
export { exportService } from './exportService';
