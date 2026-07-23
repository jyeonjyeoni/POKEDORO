import { describe,expect,it } from 'vitest';
import { defaultData } from './store';
import { removeCompletedTodos } from './todos';

describe('completed todo cleanup',()=>{
  it('removes every completed todo and keeps active todos',()=>{
    const data=defaultData();
    data.todos=[
      {id:'done-1',title:'Done 1',categoryId:null,estimateMinutes:10,focusSeconds:0,pomodoroCount:0,completed:true,sortOrder:0},
      {id:'active',title:'Active',categoryId:null,estimateMinutes:30,focusSeconds:0,pomodoroCount:0,completed:false,sortOrder:2},
      {id:'done-2',title:'Done 2',categoryId:null,estimateMinutes:20,focusSeconds:0,pomodoroCount:0,completed:true,sortOrder:1}
    ];
    expect(removeCompletedTodos(data).todos).toEqual([expect.objectContaining({id:'active',sortOrder:0})]);
  });

  it('clears the timer selection only when its completed todo is removed',()=>{
    const data=defaultData();
    data.todos=[
      {id:'active',title:'Active',categoryId:null,estimateMinutes:30,focusSeconds:0,pomodoroCount:0,completed:false,sortOrder:0},
      {id:'done',title:'Done',categoryId:null,estimateMinutes:10,focusSeconds:0,pomodoroCount:0,completed:true,sortOrder:1}
    ];
    data.timer.selectedTodoId='done';
    expect(removeCompletedTodos(data).timer.selectedTodoId).toBeNull();
    data.timer.selectedTodoId='active';
    expect(removeCompletedTodos(data).timer.selectedTodoId).toBe('active');
  });
});
