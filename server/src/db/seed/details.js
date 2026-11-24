// Optional event-page details for the demo events, keyed by title. Every name
// is fictional. Events not listed here simply have no extra details.
export const EVENT_DETAILS = {
  'Intro to Git & GitHub': {
    tagline: 'Branch, commit and merge without fear',
    agenda: [
      { time: '14:00', title: 'Why version control', details: 'What Git solves, in ten minutes.' },
      { time: '14:20', title: 'Hands-on: your first repository' },
      { time: '15:15', title: 'Branches and pull requests' },
      { time: '16:15', title: 'Merge conflicts, live', details: 'We break things on purpose and fix them.' },
    ],
    speakers: [
      { name: 'Hira Javed', role: 'Workshop lead, Computing Society' },
      { name: 'Omar Farooq', role: 'Teaching assistant' },
    ],
    tags: ['git', 'beginners', 'hands-on'],
    whatToBring: 'A laptop with Git installed.\nA free GitHub account.',
    entryNotes: 'Seats are first come, first served at the door for confirmed students.',
    contact: 'computing.society@eventhub.test',
  },
  'Weekend Hackathon: Build for Campus': {
    tagline: 'Twenty-four hours to make campus life easier',
    agenda: [
      { time: '09:00', title: 'Check-in and breakfast' },
      { time: '10:00', title: 'Kick-off and problem statements' },
      { time: '10:30', title: 'Team formation', details: 'Teams of up to four; mentors help solo attendees find a team.' },
      { time: '13:00', title: 'Lunch' },
      { time: '20:00', title: 'Mentor check-ins' },
      { time: '08:00', title: 'Final demos and judging (next morning)', details: 'Three minutes per team, then questions.' },
    ],
    speakers: [
      { name: 'Dr. Sara Malik', role: 'Judge, Department of Computer Science' },
      { name: 'Bilal Ahmed', role: 'Organizer, Computing Society' },
      { name: 'Zainab Malik', role: 'Mentor' },
    ],
    tags: ['hackathon', 'teams', 'prizes'],
    whatToBring: 'Laptop and charger.\nStudent card.\nA sleeping bag if you plan to stay overnight.',
    entryNotes: 'Casual dress. Meals and snacks are provided all weekend.',
    contact: 'computing.society@eventhub.test',
  },
  'Machine Learning Study Circle': {
    tagline: 'Gradient descent, regularisation and good questions',
    agenda: [
      { time: '16:00', title: 'Recap of last session' },
      { time: '16:20', title: 'Discussion: regularisation in practice' },
      { time: '17:30', title: 'Next week’s reading' },
    ],
    tags: ['machine learning', 'study group'],
    whatToBring: 'Notes on chapter 4 of the course reader.',
  },
  'Cybersecurity CTF Night': {
    tagline: 'Capture the flag: crack, decode and race the clock',
    agenda: [
      { time: '18:00', title: 'Rules and warm-up challenge' },
      { time: '18:30', title: 'Competition opens' },
      { time: '21:30', title: 'Scores frozen, write-ups' },
    ],
    speakers: [{ name: 'Usman Tariq', role: 'Challenge author' }],
    tags: ['security', 'competition'],
    whatToBring: 'A laptop with a Linux virtual machine, if you have one.',
    entryNotes: 'Play fair: attacking the scoreboard or other players means disqualification.',
  },
  'Inter-Department Futsal Cup': {
    tagline: 'Five-a-side, eight departments, one trophy',
    agenda: [
      { time: '15:00', title: 'Group stage' },
      { time: '18:00', title: 'Semi-finals' },
      { time: '20:00', title: 'Final and prize-giving' },
    ],
    tags: ['football', 'tournament'],
    whatToBring: 'Indoor shoes and a water bottle.',
    entryNotes: 'Sports kit only on the court. Spectators are welcome in the stands.',
    contact: 'sports.council@eventhub.test',
  },
  'Sunrise 5K Fun Run': {
    tagline: 'Run, jog or walk the campus loop at dawn',
    whatToBring: 'Running shoes and a water bottle.',
    entryNotes: 'Collect your bib at the Main Gate from 6:30.',
    tags: ['running', 'fitness'],
  },
  'Open Mic Poetry Evening': {
    tagline: 'Five minutes, one microphone, any language',
    speakers: [{ name: 'Mahnoor Iqbal', role: 'Host, Arts & Literary Society' }],
    tags: ['poetry', 'open mic'],
    entryNotes: 'Sign up for a slot at the door; listeners are just as welcome.',
  },
  'Photography Walk: Campus Architecture': {
    tagline: 'Find the lines, light and shadows of campus',
    agenda: [
      { time: '16:30', title: 'Meet at the Library Steps' },
      { time: '16:45', title: 'Walk: Old Block to the Lake' },
      { time: '18:00', title: 'Golden-hour shots and sharing' },
    ],
    whatToBring: 'Any camera, including a phone.',
    tags: ['photography', 'outdoors'],
  },
  'Resume & LinkedIn Clinic': {
    tagline: 'One-to-one feedback on your CV and profile',
    speakers: [
      { name: 'Career Development Office', role: 'Advisers' },
      { name: 'Sana Riaz', role: 'Recruiter (alumna)' },
    ],
    whatToBring: 'A printed or digital copy of your CV.',
    tags: ['careers', 'cv'],
    contact: 'career.office@eventhub.test',
  },
  'Alumni Talk: Careers in Product Management': {
    tagline: 'What product managers actually do all day',
    agenda: [
      { time: '14:30', title: 'Talk' },
      { time: '15:30', title: 'Questions and answers' },
      { time: '16:00', title: 'Tea and networking' },
    ],
    speakers: [{ name: 'Rayyan Chaudhry', role: 'Senior Product Manager (alumnus)' }],
    tags: ['careers', 'talk'],
  },
  'Blood Donation Camp': {
    tagline: 'One donation can help up to three patients',
    whatToBring: 'Your student card. Eat a proper meal beforehand.',
    entryNotes: 'Donors must be 18 or older and weigh at least 50 kg.',
    tags: ['volunteering', 'health'],
  },
  'Tree Plantation Drive': {
    tagline: 'Two hundred saplings along the North Campus green belt',
    whatToBring: 'Clothes you do not mind getting muddy. Gloves are provided.',
    tags: ['environment', 'volunteering'],
  },
};
