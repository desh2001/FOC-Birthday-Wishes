import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import Spotlight from './components/Spotlight';
import Timeline from './components/Timeline';
import ImageSync from './components/ImageSync';
import FilterBar from './components/FilterBar';
import StudentGrid from './components/StudentGrid';
import AddBirthdayModal from './components/Modals/AddBirthdayModal';
import StudentDetailModal from './components/Modals/StudentDetailModal';
import UpdatePhotoModal from './components/Modals/UpdatePhotoModal';
import GenerateCardModal from './components/Modals/GenerateCardModal';
import ScheduledMessagesModal from './components/Modals/ScheduledMessagesModal';
import { db } from './firebase.js';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { BIRTHDAY_DATA } from './data.js';

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

  useEffect(() => {
    const studentsRef = collection(db, 'students');
    const unsubscribe = onSnapshot(studentsRef, (snapshot) => {
      const firebaseData = [];
      snapshot.forEach((doc) => {
        firebaseData.push({ id: doc.id, ...doc.data() });
      });

      if (firebaseData.length === 0) {
        if (!sessionStorage.getItem('migrated')) {
          sessionStorage.setItem('migrated', 'true');
          console.log("Firestore is empty! Auto-migrating records...");
          BIRTHDAY_DATA.forEach(student => {
            addDoc(studentsRef, student);
          });
        }
        return;
      }
      
      // Deduplicate data
      const uniqueMap = new Map();
      const duplicatesToDelete = [];
      firebaseData.forEach(student => {
        const name = student.name ? student.name.trim().toLowerCase() : '';
        const birthday = student.birthday ? student.birthday.trim() : '';
        const key = name + '|' + birthday;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, student);
        } else {
          duplicatesToDelete.push(student.id);
        }
      });
      
      if (duplicatesToDelete.length > 0) {
        console.log(`Found ${duplicatesToDelete.length} duplicates in Firestore. Cleaning up...`);
        duplicatesToDelete.forEach(id => {
          import('firebase/firestore').then(({ doc, deleteDoc }) => {
            deleteDoc(doc(db, 'students', id)).catch(err => console.error(err));
          });
        });
      }

      setStudents(Array.from(uniqueMap.values()));
    }, (error) => {
      console.error("Firebase connection error:", error);
    });

    return () => unsubscribe();
  }, []);

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

  // Spotlight is the absolute next birthday
  const spotlightStudent = sortedStudents.length > 0 ? sortedStudents[0] : null;
  // Timeline shows the next 5 after the spotlight
  const upcomingStudents = sortedStudents.length > 1 ? sortedStudents.slice(1, 6) : [];

  const filteredStudents = useMemo(() => {
    return sortedStudents.filter(student => {
      let matchesSearch = true;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        matchesSearch = 
          student.name.toLowerCase().includes(query) ||
          (student.featured_name && student.featured_name.toLowerCase().includes(query)) ||
          student.course.toLowerCase().includes(query) ||
          student.birthday.includes(query);
      }
      
      let matchesMonth = true;
      if (selectedMonth !== 'all') {
        const parts = student.birthday.split('/');
        if (parts.length === 3) {
          // Compare as numbers to strip leading zeros
          const m = parseInt(parts[1], 10).toString();
          matchesMonth = m === selectedMonth;
        }
      }

      let matchesCourse = true;
      if (selectedCourse !== 'all') {
        matchesCourse = student.course === selectedCourse;
      }

      let matchesGender = true;
      if (selectedGender !== 'all') {
        matchesGender = student.gender === selectedGender;
      }
      
      return matchesSearch && matchesMonth && matchesCourse && matchesGender;
    });
  }, [sortedStudents, searchQuery, selectedMonth, selectedCourse, selectedGender]);

  return (
    <div className="app-container">
      <Header 
        onAddClick={() => setIsAddModalOpen(true)} 
        onViewScheduledClick={() => setIsScheduledModalOpen(true)}
      />
      
      <ImageSync />

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
          onBirthdayAdded={() => setIsAddModalOpen(false)}
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
