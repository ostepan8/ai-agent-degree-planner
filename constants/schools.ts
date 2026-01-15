import type { School } from '@/lib/schemas'

// Popular schools with known catalog URLs for faster lookup
export const popularSchools: School[] = [
  {
    id: 'northeastern',
    name: 'Northeastern University',
    shortName: 'NEU',
    catalogUrl: 'https://catalog.northeastern.edu',
    location: 'Boston, MA',
  },
  {
    id: 'mit',
    name: 'Massachusetts Institute of Technology',
    shortName: 'MIT',
    catalogUrl: 'https://catalog.mit.edu',
    location: 'Cambridge, MA',
  },
  {
    id: 'bu',
    name: 'Boston University',
    shortName: 'BU',
    catalogUrl: 'https://www.bu.edu/academics/bulletin',
    location: 'Boston, MA',
  },
  {
    id: 'harvard',
    name: 'Harvard University',
    shortName: 'Harvard',
    catalogUrl: 'https://courses.my.harvard.edu',
    location: 'Cambridge, MA',
  },
  {
    id: 'umass-amherst',
    name: 'University of Massachusetts Amherst',
    shortName: 'UMass',
    catalogUrl: 'https://www.umass.edu/registrar/course-descriptions',
    location: 'Amherst, MA',
  },
  {
    id: 'stanford',
    name: 'Stanford University',
    shortName: 'Stanford',
    catalogUrl: 'https://explorecourses.stanford.edu',
    location: 'Stanford, CA',
  },
  {
    id: 'berkeley',
    name: 'University of California, Berkeley',
    shortName: 'UC Berkeley',
    catalogUrl: 'https://guide.berkeley.edu',
    location: 'Berkeley, CA',
  },
  {
    id: 'cmu',
    name: 'Carnegie Mellon University',
    shortName: 'CMU',
    catalogUrl: 'https://www.cmu.edu/hub/registrar/course-schedule',
    location: 'Pittsburgh, PA',
  },
  {
    id: 'georgia-tech',
    name: 'Georgia Institute of Technology',
    shortName: 'Georgia Tech',
    catalogUrl: 'https://catalog.gatech.edu',
    location: 'Atlanta, GA',
  },
  {
    id: 'uiuc',
    name: 'University of Illinois Urbana-Champaign',
    shortName: 'UIUC',
    catalogUrl: 'https://courses.illinois.edu',
    location: 'Champaign, IL',
  },
  {
    id: 'boston-college',
    name: 'Boston College',
    shortName: 'BC',
    catalogUrl: 'https://www.bc.edu/bc-web/schools/mcas/departments/computer-science.html',
    location: 'Chestnut Hill, MA',
  },
  {
    id: 'tufts',
    name: 'Tufts University',
    shortName: 'Tufts',
    catalogUrl: 'https://www.cs.tufts.edu',
    location: 'Medford, MA',
  },
  {
    id: 'brandeis',
    name: 'Brandeis University',
    shortName: 'Brandeis',
    catalogUrl: 'https://www.brandeis.edu/computer-science',
    location: 'Waltham, MA',
  },
  {
    id: 'bentley',
    name: 'Bentley University',
    shortName: 'Bentley',
    catalogUrl: 'https://www.bentley.edu/academics',
    location: 'Waltham, MA',
  },
  {
    id: 'suffolk',
    name: 'Suffolk University',
    shortName: 'Suffolk',
    catalogUrl: 'https://www.suffolk.edu/academics',
    location: 'Boston, MA',
  },
  {
    id: 'umass-boston',
    name: 'University of Massachusetts Boston',
    shortName: 'UMass Boston',
    catalogUrl: 'https://www.umb.edu/academics/course-catalog',
    location: 'Boston, MA',
  },
  {
    id: 'wpi',
    name: 'Worcester Polytechnic Institute',
    shortName: 'WPI',
    catalogUrl: 'https://www.wpi.edu/academics/calendar-courses',
    location: 'Worcester, MA',
  },
]

// Helper to find a school by ID
export function findSchoolById(id: string): School | undefined {
  return popularSchools.find(school => school.id === id)
}

// Helper to search schools by name
export function searchPopularSchools(query: string): School[] {
  const lowerQuery = query.toLowerCase()
  return popularSchools.filter(
    school =>
      school.name.toLowerCase().includes(lowerQuery) ||
      school.shortName?.toLowerCase().includes(lowerQuery) ||
      school.location?.toLowerCase().includes(lowerQuery)
  )
}

