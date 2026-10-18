import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import Spotlight from './components/Spotlight';
import Timeline from './components/Timeline';
import FilterBar from './components/FilterBar';
import StudentGrid from './components/StudentGrid';
import AddBirthdayModal from './components/Modals/AddBirthdayModal';
import StudentDetailModal from './components/Modals/StudentDetailModal';
import UpdatePhotoModal from './components/Modals/UpdatePhotoModal';
import GenerateCardModal from './components/Modals/GenerateCardModal';
import ScheduledMessagesModal from './components/Modals/ScheduledMessagesModal';
import { BIRTHDAY_DATA } from './data.js';
import { BOT_API_URL } from './utils.js';

export default function App() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScheduledModalOpen, setIsScheduledModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [studentToUpdate, setStudentToUpdate] = useState(null);
  const [generateCardStudent, setGenerateCardStudent] = useState(null);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await fetch(`${BOT_API_URL}/students`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setStudents(data);
          return;
        }
      }
      setStudents(BIRTHDAY_DATA);
    } catch (err) {
      console.warn("Could not load students from bot API, using static data:", err);
      setStudents(BIRTHDAY_DATA);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Sort students globally by next upcoming birthday
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const getNextBday = (bStr) => {
        if (!bStr) return 0;
        const parts = bStr.split('/');
        if (parts.length !== 3) return 0;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const today = new Date();
        today.setHours(0,0,0,0);
        let bday = new Date(today.getFullYear(), month, day);
        if (bday < today) {
          bday.setFullYear(today.getFullYear() + 1);
        }
        return bday.getTime();
      };
      return getNextBday(a.birthday) - getNextBday(b.birthday);
    });
  }, [students]);

  // Spotlight student: person with birthday today or next upcoming
  const spotlightStudent = useMemo(() => {
    if (sortedStudents.length === 0) return null;
    return sortedStudents[0];
  }, [sortedStudents]);

  // Upcoming students: next 5 students excluding spotlight
  const upcomingStudents = useMemo(() => {
    if (sortedStudents.length <= 1) return [];
    return sortedStudents.slice(1, 6);
  }, [sortedStudents]);

  // Filter students based on search and dropdown selections
  const filteredStudents = useMemo(() => {
    return sortedStudents.filter((student) => {
      const matchesSearch = searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.featured_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.whatsapp.includes(searchQuery);

      const matchesMonth = selectedMonth === 'all' || (() => {
        if (!student.birthday) return false;
        const parts = student.birthday.split('/');
        if (parts.length < 2) return false;
        return parseInt(parts[1], 10) === parseInt(selectedMonth, 10);
      })();

      const matchesCourse = selectedCourse === 'all' || 
        (student.course && student.course.toUpperCase() === selectedCourse.toUpperCase());

      const matchesGender = selectedGender === 'all' || 
        (student.gender && student.gender.toLowerCase() === selectedGender.toLowerCase());
      
      return matchesSearch && matchesMonth && matchesCourse && matchesGender;
    });
  }, [sortedStudents, searchQuery, selectedMonth, selectedCourse, selectedGender]);

  return (
    <div className="app-container">
      <Header 
        onAddClick={() => setIsAddModalOpen(true)} 
        onViewScheduledClick={() => setIsScheduledModalOpen(true)}
      />

      <StatsBar students={students} />
      
      <Spotlight 
        student={spotlightStudent} 
        onStudentClick={setSelectedStudent} 
        onGenerateCard={setGenerateCardStudent}
      />
      
      {upcomingStudents.length > 0 && (
        <Timeline upcomingStudents={upcomingStudents} onStudentClick={setSelectedStudent} />
      )}
      
      <section className="directory-section">
        <FilterBar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedCourse={selectedCourse}
          setSelectedCourse={setSelectedCourse}
          selectedGender={selectedGender}
          setSelectedGender={setSelectedGender}
        />
        
        <StudentGrid 
          students={filteredStudents} 
          onStudentClick={setSelectedStudent} 
        />
      </section>

      {isAddModalOpen && (
        <AddBirthdayModal 
          onClose={() => setIsAddModalOpen(false)} 
          onBirthdayAdded={() => {
            fetchStudents();
            setIsAddModalOpen(false);
          }}
        />
      )}

      {isScheduledModalOpen && (
        <ScheduledMessagesModal
          onClose={() => setIsScheduledModalOpen(false)}
        />
      )}

      {selectedStudent && (
        <StudentDetailModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)}
          onUpdatePhoto={(s) => {
            setStudentToUpdate(s);
            setSelectedStudent(null);
          }}
          onGenerateCard={(s) => {
            setGenerateCardStudent(s);
            setSelectedStudent(null);
          }}
        />
      )}
      
      {studentToUpdate && (
        <UpdatePhotoModal 
          student={studentToUpdate}
          onClose={() => setStudentToUpdate(null)}
          onPhotoUpdated={(newUrl) => {
            fetchStudents();
            const updated = { ...studentToUpdate, photo_url: newUrl };
            setStudentToUpdate(null);
            setSelectedStudent(updated);
          }}
        />
      )}

      {generateCardStudent && (
        <GenerateCardModal 
          student={generateCardStudent}
          onClose={() => setGenerateCardStudent(null)}
        />
      )}
    </div>
  );
}
