import React from 'react';
import { Search, X, BookOpen, Calendar, User } from 'lucide-react';

export default function FilterBar({ 
  searchQuery, setSearchQuery, 
  selectedMonth, setSelectedMonth,
  selectedCourse, setSelectedCourse,
  selectedGender, setSelectedGender
}) {
  return (
    <div className="directory-header">
      <h2 className="section-title">
        <BookOpen size={24} style={{ marginRight: '10px', color: 'var(--color-accent)' }} /> 
        Student Directory
      </h2>
      
      <div className="filter-controls glass-panel">
        <div className="search-box">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search by name or number..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="dropdown-filters">
          <div className="select-wrapper">
            <BookOpen className="select-icon" size={16} />
            <select 
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="all">All Courses</option>
              <option value="CS">Computer Science (CS)</option>
              <option value="SE">Software Engineering (SE)</option>
              <option value="IS">Information Systems (IS)</option>
            </select>
          </div>
          
          <div className="select-wrapper">
            <Calendar className="select-icon" size={16} />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div className="select-wrapper">
            <User className="select-icon" size={16} />
            <select 
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
