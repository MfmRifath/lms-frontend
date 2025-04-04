import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import CoursesPage from './pages/CoursesPage.tsx';

// Add this CSS to your App.css or create a new file
/* 
.navbar {
  @apply bg-gray-800 text-white;
}
.nav-link {
  @apply px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700;
}
.nav-link-active {
  @apply bg-gray-900;
}
.main-content {
  @apply flex-1;
}
*/

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <nav className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-xl font-bold">Course Portal</span>
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">Home</Link>
                    <Link to="/courses" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-900 hover:bg-gray-700">Courses</Link>
                    <Link to="/about" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">About</Link>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                  Sign In
                </button>
              </div>
              <div className="md:hidden">
                <button className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none">
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:id" element={<CourseDetails />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="bg-gray-800 text-white py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <p>&copy; {new Date().getFullYear()} Course Portal. All rights reserved.</p>
              </div>
              <div className="flex space-x-6">
                <Link to="/terms" className="text-gray-300 hover:text-white">
                  Terms
                </Link>
                <Link to="/privacy" className="text-gray-300 hover:text-white">
                  Privacy
                </Link>
                <Link to="/contact" className="text-gray-300 hover:text-white">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

// Placeholder components
const Home = () => (
  <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto text-center">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Welcome to Course Portal</h1>
      <p className="text-xl text-gray-600 mb-8">Your gateway to high-quality online education</p>
      <Link to="/courses" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
        Browse Courses
      </Link>
    </div>
  </div>
);

const CourseDetails = () => (
  <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Course Details</h1>
      <p className="text-gray-600 mb-4">This is a placeholder for course details. Replace this with actual course information.</p>
      <Link to="/courses" className="text-blue-600 hover:text-blue-800">← Back to Courses</Link>
    </div>
  </div>
);

const About = () => (
  <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">About Us</h1>
      <p className="text-gray-600 mb-4">This is a placeholder for the About page.</p>
    </div>
  </div>
);

const NotFound = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-2xl text-gray-600 mb-6">Page not found</p>
      <Link to="/" className="text-blue-600 hover:text-blue-800">Go back home</Link>
    </div>
  </div>
);

export default App;