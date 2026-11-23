// Fictional seed data. Every name, email and student number is made up;
// the .test TLD is reserved and can never receive real mail.

export const PASSWORDS = {
  student: 'Student@123',
  organizer: 'Organizer@123',
  admin: 'Admin@123',
};

export const ADMIN = { fullName: 'Platform Admin', email: 'admin@eventhub.test' };

// Index in this array is referenced by EVENTS[].organizer.
export const ORGANIZERS = [
  { fullName: 'Computing Society', email: 'computing.society@eventhub.test', department: 'Computer Science' },
  { fullName: 'Sports Council', email: 'sports.council@eventhub.test', department: 'Student Affairs' },
  { fullName: 'Arts & Literary Society', email: 'arts.society@eventhub.test', department: 'Humanities' },
  { fullName: 'Career Development Office', email: 'career.office@eventhub.test', department: 'Student Affairs' },
];

const STUDENT_NAMES = [
  'Ayesha Khan', 'Bilal Ahmed', 'Fatima Raza', 'Hamza Siddiqui', 'Zainab Malik',
  'Usman Tariq', 'Hira Javed', 'Ali Hassan', 'Mahnoor Iqbal', 'Saad Qureshi',
  'Iqra Nadeem', 'Omar Farooq', 'Sana Riaz', 'Daniyal Shah', 'Maryam Aslam',
  'Taha Mirza', 'Noor Fatima', 'Hassan Ali', 'Amna Sheikh', 'Fahad Butt',
  'Laiba Zafar', 'Arham Rehman', 'Eman Saleem', 'Rayyan Chaudhry', 'Kinza Awan',
];

const DEPARTMENTS = [
  'Computer Science', 'Electrical Engineering', 'Mechanical Engineering',
  'Business Administration', 'Civil Engineering', 'Architecture',
];

export const STUDENTS = STUDENT_NAMES.map((fullName, index) => ({
  fullName,
  email: `${fullName.toLowerCase().replace(' ', '.')}@eventhub.test`,
  department: DEPARTMENTS[index % DEPARTMENTS.length],
  studentNumber: `EH-${String(410001 + index)}`,
}));

export const CATEGORIES = [
  { name: 'Technology', slug: 'technology', description: 'Coding, hackathons and tech talks.' },
  { name: 'Workshops', slug: 'workshops', description: 'Hands-on skill-building sessions.' },
  { name: 'Sports', slug: 'sports', description: 'Tournaments, fun runs and fitness.' },
  { name: 'Arts & Culture', slug: 'arts-culture', description: 'Music, drama, poetry and art.' },
  { name: 'Career', slug: 'career', description: 'CV clinics, interviews and job fairs.' },
  { name: 'Entrepreneurship', slug: 'entrepreneurship', description: 'Startups, pitching and business.' },
  { name: 'Community Service', slug: 'community-service', description: 'Volunteering and social impact.' },
  { name: 'Academic Talks', slug: 'academic-talks', description: 'Guest lectures and seminars.' },
];

// Dates are relative to today so the seed always produces upcoming and past events;
// startTime is campus local time (see CAMPUS_UTC_OFFSET_HOURS in index.js).
// confirmed / waitlisted / cancelled are how many seeded students hold each status.
export const EVENTS = [
  {
    title: 'Intro to Git & GitHub', category: 'workshops', organizer: 0, status: 'published',
    venue: 'CS Lab 3', startsInDays: 5, startTime: '14:00', durationHours: 3, capacity: 40,
    confirmed: 18, waitlisted: 0, cancelled: 2,
    description: 'Learn branching, pull requests and resolving merge conflicts. Bring a laptop with Git installed.',
  },
  {
    title: 'Weekend Hackathon: Build for Campus', category: 'technology', organizer: 0, status: 'published',
    venue: 'Innovation Center', startsInDays: 14, startTime: '09:00', durationHours: 24, capacity: 60,
    confirmed: 22, waitlisted: 0, cancelled: 1,
    description: 'Team up and build something that makes campus life easier. Meals provided; teams of up to four.',
  },
  {
    title: 'Machine Learning Study Circle', category: 'technology', organizer: 0, status: 'published',
    venue: 'Library Seminar Room', startsInDays: 3, startTime: '16:00', durationHours: 2, capacity: 6,
    confirmed: 6, waitlisted: 3, cancelled: 1,
    description: 'A small-group discussion of gradient descent and regularisation. Seats are intentionally limited.',
  },
  {
    title: 'Cybersecurity CTF Night', category: 'technology', organizer: 0, status: 'published',
    venue: 'CS Lab 1', startsInDays: 9, startTime: '18:00', durationHours: 4, capacity: 20,
    confirmed: 19, waitlisted: 0, cancelled: 0,
    description: 'Capture-the-flag challenges in web, crypto and forensics. Beginners welcome; prizes for top three.',
  },
  {
    title: 'React Basics Bootcamp', category: 'workshops', organizer: 0, status: 'draft',
    venue: 'CS Lab 2', startsInDays: 30, startTime: '09:30', durationHours: 6, capacity: 50,
    confirmed: 0, waitlisted: 0, cancelled: 0,
    description: 'A full-day introduction to components, state and hooks.',
  },
  {
    title: 'Inter-Department Futsal Cup', category: 'sports', organizer: 1, status: 'published',
    venue: 'Indoor Sports Complex', startsInDays: 7, startTime: '15:00', durationHours: 6, capacity: 24,
    confirmed: 12, waitlisted: 0, cancelled: 0,
    description: 'Five-a-side knockout tournament between departments. Register individually; teams are formed on the day.',
  },
  {
    title: 'Sunrise 5K Fun Run', category: 'sports', organizer: 1, status: 'published',
    venue: 'Main Gate', startsInDays: 1, startTime: '07:00', durationHours: 2, capacity: 100,
    registrationDeadlineHoursBefore: 36, cancellationWindowHours: 48,
    confirmed: 10, waitlisted: 0, cancelled: 0,
    description: 'An easy-paced 5K around campus. Registration has closed so we can order the right number of shirts.',
  },
  {
    title: 'Table Tennis Doubles Open', category: 'sports', organizer: 1, status: 'pending',
    venue: 'Student Center Hall', startsInDays: 12, startTime: '11:00', durationHours: 5, capacity: 16,
    confirmed: 0, waitlisted: 0, cancelled: 0,
    description: 'Doubles bracket open to all skill levels. Paddles available on loan.',
  },
  {
    title: 'Badminton Ladder Finals', category: 'sports', organizer: 1, status: 'published',
    venue: 'Indoor Sports Complex', startsInDays: -6, startTime: '15:00', durationHours: 4, capacity: 16,
    confirmed: 14, waitlisted: 0, cancelled: 0,
    description: 'Final round of the semester badminton ladder.',
  },
  {
    title: 'Open Mic Poetry Evening', category: 'arts-culture', organizer: 2, status: 'published',
    venue: 'Amphitheater', startsInDays: 4, startTime: '17:30', durationHours: 2, capacity: 5,
    confirmed: 5, waitlisted: 2, cancelled: 0,
    description: 'Five performer slots for original poetry in English or Urdu. Audience entry is open to all.',
  },
  {
    title: 'Photography Walk: Campus Architecture', category: 'arts-culture', organizer: 2, status: 'published',
    venue: 'Library Steps', startsInDays: 10, startTime: '16:30', durationHours: 2, capacity: 15,
    confirmed: 7, waitlisted: 0, cancelled: 0,
    description: 'A guided golden-hour walk with composition tips. Phone cameras are fine.',
  },
  {
    title: 'Drama Society Auditions', category: 'arts-culture', organizer: 2, status: 'pending',
    venue: 'Auditorium', startsInDays: 20, startTime: '13:00', durationHours: 4, capacity: 30,
    confirmed: 0, waitlisted: 0, cancelled: 0,
    description: 'Auditions for the spring production. Prepare a two-minute monologue.',
  },
  {
    title: 'Calligraphy Workshop', category: 'workshops', organizer: 2, status: 'published',
    venue: 'Art Studio', startsInDays: -12, startTime: '11:00', durationHours: 3, capacity: 20,
    confirmed: 16, waitlisted: 0, cancelled: 0,
    description: 'Introduction to nastaliq strokes. All materials provided.',
  },
  {
    title: 'Food Festival Stall Sign-ups', category: 'arts-culture', organizer: 2, status: 'rejected',
    venue: 'Central Lawn', startsInDays: 25, startTime: '12:00', durationHours: 8, capacity: 40,
    rejectionReason: 'Venue booking has not been confirmed by the estate office.',
    confirmed: 0, waitlisted: 0, cancelled: 0,
    description: 'Sign up to run a food stall at the end-of-semester festival.',
  },
  {
    title: 'Resume & LinkedIn Clinic', category: 'career', organizer: 3, status: 'published',
    venue: 'Career Center', startsInDays: 6, startTime: '10:00', durationHours: 3, capacity: 30,
    confirmed: 9, waitlisted: 0, cancelled: 2,
    description: 'One-on-one feedback on your CV and LinkedIn profile from career advisors.',
  },
  {
    title: 'Startup Pitch Night', category: 'entrepreneurship', organizer: 3, status: 'published',
    venue: 'Business School Auditorium', startsInDays: 16, startTime: '18:00', durationHours: 3, capacity: 50,
    confirmed: 15, waitlisted: 0, cancelled: 0,
    description: 'Student founders pitch to a panel of alumni investors. Audience vote decides the people\'s choice award.',
  },
  {
    title: 'Tree Plantation Drive', category: 'community-service', organizer: 3, status: 'closed',
    venue: 'North Campus Green Belt', startsInDays: 8, startTime: '08:30', durationHours: 3, capacity: 40,
    confirmed: 20, waitlisted: 0, cancelled: 0,
    description: 'Help plant 300 saplings along the green belt. Registrations closed once enough volunteers signed up.',
  },
  {
    title: 'Alumni Talk: Careers in Product Management', category: 'academic-talks', organizer: 3, status: 'published',
    venue: 'Lecture Theater 2', startsInDays: 11, startTime: '14:30', durationHours: 2, capacity: 80,
    confirmed: 4, waitlisted: 0, cancelled: 0,
    description: 'Alumni working as product managers share how they made the switch from engineering.',
  },
  {
    title: 'Mock Interview Day', category: 'career', organizer: 3, status: 'draft',
    venue: 'Career Center', startsInDays: 35, startTime: '09:00', durationHours: 6, capacity: 25,
    confirmed: 0, waitlisted: 0, cancelled: 0,
    description: 'Practice technical and behavioural interviews with volunteer recruiters.',
  },
  {
    title: 'Blood Donation Camp', category: 'community-service', organizer: 3, status: 'published',
    venue: 'Medical Center', startsInDays: 1, startTime: '10:00', durationHours: 6, capacity: 60,
    cancellationWindowHours: 48,
    confirmed: 8, waitlisted: 0, cancelled: 0,
    description: 'Donate blood with the university medical center. Eat a proper meal beforehand and bring your student card.',
  },
];
