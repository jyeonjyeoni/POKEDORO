import type { AppData } from './types';

export function removeCompletedTodos(data:AppData):AppData {
  const completedIds=new Set(data.todos.filter(todo=>todo.completed).map(todo=>todo.id));
  if(!completedIds.size)return data;
  const selectedTodoRemoved=Boolean(data.timer.selectedTodoId&&completedIds.has(data.timer.selectedTodoId));
  const remaining=data.todos
    .filter(todo=>!completedIds.has(todo.id))
    .sort((a,b)=>a.sortOrder-b.sortOrder)
    .map((todo,sortOrder)=>todo.sortOrder===sortOrder?todo:{...todo,sortOrder});
  return {
    ...data,
    todos:remaining,
    timer:selectedTodoRemoved?{...data.timer,selectedTodoId:null}:data.timer
  };
}
