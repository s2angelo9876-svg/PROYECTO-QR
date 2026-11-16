import type { Student } from '@/types/attendance';

// Base de datos mock de estudiantes para el demo
export const MOCK_STUDENTS: Student[] = [
  {
    id: 's-001',
    dni: '72345678',
    firstName: 'Sofía',
    lastName: 'Quispe Mamani',
    fullName: 'Sofía Quispe Mamani',
    grade: '5° de Secundaria',
    section: 'A',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=47',
    status: 'ACTIVE',
    guardianName: 'María Mamani de Quispe',
    guardianPhone: '+51 987 654 321',
  },
  {
    id: 's-002',
    dni: '71234567',
    firstName: 'Mateo',
    lastName: 'Huamán Rivera',
    fullName: 'Mateo Huamán Rivera',
    grade: '4° de Secundaria',
    section: 'B',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=12',
    status: 'ACTIVE',
    guardianName: 'José Huamán Torres',
    guardianPhone: '+51 999 111 222',
  },
  {
    id: 's-003',
    dni: '73456789',
    firstName: 'Valentina',
    lastName: 'Chávez López',
    fullName: 'Valentina Chávez López',
    grade: '3° de Secundaria',
    section: 'A',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=49',
    status: 'ACTIVE',
    guardianName: 'Rosa López Vargas',
    guardianPhone: '+51 977 888 555',
  },
  {
    id: 's-004',
    dni: '74567890',
    firstName: 'Sebastián',
    lastName: 'Rojas Córdova',
    fullName: 'Sebastián Rojas Córdova',
    grade: '5° de Secundaria',
    section: 'B',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=33',
    status: 'SUSPENDED',
    guardianName: 'Carlos Rojas Díaz',
    guardianPhone: '+51 955 444 333',
  },
  {
    id: 's-005',
    dni: '75678901',
    firstName: 'Camila',
    lastName: 'Vargas Salazar',
    fullName: 'Camila Vargas Salazar',
    grade: '4° de Secundaria',
    section: 'A',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=45',
    status: 'ACTIVE',
    guardianName: 'Lucía Salazar Pérez',
    guardianPhone: '+51 922 333 444',
  },
  {
    id: 's-006',
    dni: '76789012',
    firstName: 'Diego',
    lastName: 'Mendoza Aguilar',
    fullName: 'Diego Mendoza Aguilar',
    grade: '3° de Secundaria',
    section: 'C',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=15',
    status: 'ACTIVE',
    guardianName: 'Pedro Mendoza Ríos',
    guardianPhone: '+51 933 222 111',
  },
  {
    id: 's-007',
    dni: '77890123',
    firstName: 'Isabella',
    lastName: 'Castillo Núñez',
    fullName: 'Isabella Castillo Núñez',
    grade: '5° de Secundaria',
    section: 'A',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=44',
    status: 'ACTIVE',
    guardianName: 'Patricia Núñez Vega',
    guardianPhone: '+51 944 111 999',
  },
  {
    id: 's-008',
    dni: '78901234',
    firstName: 'Lucas',
    lastName: 'Paredes Gómez',
    fullName: 'Lucas Paredes Gómez',
    grade: '4° de Secundaria',
    section: 'C',
    shift: 'MORNING',
    photoUrl: 'https://i.pravatar.cc/300?img=8',
    status: 'GRADUATED',
    guardianName: 'Ana Gómez Ríos',
    guardianPhone: '+51 966 555 888',
  },
];

// Mapa en memoria para idempotencia
const idempotencyCache = new Map<string, { timestamp: number; response: unknown }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function getStudentByDni(dni: string): Student | undefined {
  return MOCK_STUDENTS.find((s) => s.dni === dni);
}

export function checkIdempotency(clientScanId: string): unknown | null {
  const entry = idempotencyCache.get(clientScanId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(clientScanId);
    return null;
  }
  return entry.response;
}

export function saveIdempotency(clientScanId: string, response: unknown): void {
  idempotencyCache.set(clientScanId, { timestamp: Date.now(), response });
  // Limpieza periódica
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of idempotencyCache.entries()) {
      if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(key);
      }
    }
  }
}
