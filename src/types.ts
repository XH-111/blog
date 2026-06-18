export type ArticleSection = {
  id: string;
  title: string;
  level: 2 | 3;
  body: string;
  list?: string[];
};

export type Article = {
  id: number;
  title: string;
  excerpt: string;
  summary: string;
  date: string;
  category: string;
  tags: string[];
  reads: string;
  viewsCount?: number;
  likes: number;
  comments: number;
  readingMinutes: number;
  image: "next" | "docker" | "vue" | "linux" | "mountain" | "code" | "dashboard";
  coverUrl?: string;
  allowComment?: boolean;
  featured?: boolean;
  visibility?: "public" | "private" | "password";
  passwordRequired?: boolean;
  passwordHint?: string;
  locked?: boolean;
  sections: ArticleSection[];
  codeSample?: string;
  previousId?: number;
  previousTitle?: string;
  nextId?: number;
  nextTitle?: string;
};

export type Message = {
  id: number;
  parentId?: number | null;
  author: string;
  role: string;
  avatar: string;
  time: string;
  content: string;
  likes: number;
  approved: boolean;
  replies?: Message[];
};
