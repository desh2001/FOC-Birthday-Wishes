import React from 'react';
import StudentCard from './StudentCard';

export default function StudentGrid({ students, onStudentClick }) {
  if (students.length === 0) {
    return (
      <div className="no-results">
        <h3>No Birthdays Found</h3>
        <p>Try adjusting your search criteria or adding a new member.</p>
      </div>
    );
  }

  return (
    <div className="directory-grid" id="directory-grid">
      {students.map((student, index) => (
        <StudentCard key={student.id || student.name + index} student={student} onClick={onStudentClick} />
      ))}
    </div>
  );
}
