import type { CollectionFieldType } from '@/types';

/**
 * Sample Collections Configuration
 *
 * Defines pre-built collection templates with fields and sample items.
 * Used by the CMS to let users quickly scaffold common content structures.
 */

export interface SampleFieldDefinition {
  name: string;
  key: string | null;
  type: CollectionFieldType;
  fillable: boolean;
  hidden: boolean;
  order: number;
}

export interface SampleItemDefinition {
  /** Values keyed by field key (matches SampleFieldDefinition.key) */
  values: Record<string, string>;
  /** Image URLs keyed by field key -- will be created as assets, value replaced with asset ID */
  images?: Record<string, string>;
}

export interface SampleCollectionDefinition {
  id: string;
  name: string;
  /** Built-in fields are auto-created by the store, these are the EXTRA custom fields */
  customFields: SampleFieldDefinition[];
  items: SampleItemDefinition[];
}

/**
 * All available sample collections
 */
export const SAMPLE_COLLECTIONS: SampleCollectionDefinition[] = [
  {
    id: 'blog-posts',
    name: 'Blog posts',
    customFields: [
      { name: 'Image', key: 'image', type: 'image', fillable: true, hidden: false, order: 5 },
      { name: 'Description', key: 'description', type: 'text', fillable: true, hidden: false, order: 6 },
      { name: 'Content', key: 'content', type: 'rich_text', fillable: true, hidden: false, order: 7 },
    ],
    items: [
      {
        values: {
          name: 'Mastering the Art of Meal Planning',
          slug: 'mastering-the-art-of-meal-planning',
          description: 'Tips and strategies for meal planning, including how to plan meals in advance and save time.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Eating a balanced and healthy diet is essential for maintaining good physical and mental health. However, with busy schedules, it can be difficult to find the time to prepare nutritious meals. Meal planning is an effective solution for ensuring that you always have healthy food on hand, and it can help you save time and money as well."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the keys to successful meal planning is to plan ahead. Before you go grocery shopping, take the time to plan out your meals for the upcoming week. Consider what you already have in your pantry and fridge, and then make a grocery list based on the ingredients you need to make your planned meals."}]},{"type":"paragraph","content":[{"type":"text","text":"To get started with meal planning, try to choose a day of the week when you have a little extra time, such as a Sunday, to plan and prepare for the week ahead. Start by making a list of your favorite healthy meals and then plan out your menu for the week, taking into account any special events or busy days that may require a quick and easy meal."}]},{"type":"paragraph","content":[{"type":"text","text":"Another important aspect of meal planning is to make use of leftovers. When you cook a meal, make a little extra so that you can enjoy it again later in the week. This is a great way to save time and money, and it also helps to reduce food waste."}]},{"type":"paragraph","content":[{"type":"text","text":"In addition to planning ahead and making use of leftovers, there are other strategies you can use to make meal planning more manageable. For example, try to prepare a few meals in advance, such as cooking a large batch of soup or chili that can be reheated throughout the week. You can also try to make use of your slow cooker or pressure cooker, which can make meal preparation a lot easier."}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, mastering the art of meal planning is an effective way to ensure that you always have healthy food on hand, and it can help you save time and money as well. By planning ahead, making use of leftovers, and using tools such as a slow cooker or pressure cooker, you can make meal planning more manageable and achieve your health goals."}]}]}',
        },
        images: { image: 'blog-meal-planning.webp' },
      },
      {
        values: {
          name: 'The Future of Remote Work',
          slug: 'the-future-of-remote-work',
          description: 'Exploring how companies are adapting to the new normal of remote work and the challenges and benefits.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The COVID-19 pandemic has accelerated the shift towards remote work, and many companies are now adapting to this new normal. According to a recent survey, more than 80% of companies plan to allow employees to continue working remotely at least some of the time in the future."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the biggest challenges that companies are facing with remote work is maintaining productivity and collaboration among employees. To address this, companies are turning to technology to help facilitate communication and collaboration among remote employees. Tools such as video conferencing, instant messaging, and project management software are becoming increasingly important for remote teams."}]},{"type":"paragraph","content":[{"type":"text","text":"Another challenge that companies are facing with remote work is managing employee well-being. Without the social interactions and camaraderie that come with working in an office, remote employees can feel isolated and disconnected. To address this, companies are implementing strategies such as virtual team building activities and regular check-ins to help maintain a sense of community among remote employees."}]},{"type":"paragraph","content":[{"type":"text","text":"Remote work also poses some new challenges in terms of cybersecurity. With more employees working remotely, companies need to ensure that their data and systems are secure. Remote work also increases the risk of phishing and social engineering attacks. In response, companies are implementing stronger security protocols and providing employee training on cybersecurity best practices."}]},{"type":"paragraph","content":[{"type":"text","text":"In addition to these challenges, remote work is also changing the way companies think about their real estate. With more employees working remotely, companies may not need as much office space as they once did. This could lead to a reduction in office space and a corresponding increase in flexible and coworking spaces."}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, the shift towards remote work is here to stay, and companies are adapting to this new normal. By leveraging technology to facilitate communication and collaboration, managing employee well-being, and addressing cybersecurity concerns, companies can ensure that their remote teams are productive and engaged."}]}]}',
        },
        images: { image: 'blog-remote-work.webp' },
      },
      {
        values: {
          name: '5 Tips for Staying Productive While Working from Home',
          slug: '5-tips-for-staying-productive',
          description: 'Practical tips for staying productive and focused while working from home.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Working from home has become the new normal for many employees due to the COVID-19 pandemic. However, it can be challenging to maintain productivity and focus when working from home. Here are five tips to help you stay productive while working remotely:"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Create a dedicated workspace: Having a dedicated workspace can help you separate your work and personal life. This can be a separate room or a designated area in your home. Make sure your workspace is comfortable, organized, and has all the tools you need to do your job."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Set a schedule: Having a set schedule can help you stay on track and maintain a sense of structure. Set specific hours for when you will work and when you will take breaks. Try to stick to a routine as much as possible, including when you start and end your workday."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Prioritize your tasks: Make a list of the most important tasks you need to accomplish each day. Prioritizing your tasks can help you stay focused and avoid distractions. You can also try to tackle your most challenging tasks when you have the most energy and focus."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Take breaks: Taking regular breaks can help you stay refreshed and focused. Take short breaks throughout the day to stretch, move around, or do something completely unrelated to work. This can help you come back to your work with renewed energy and focus."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Communicate with your colleagues: Staying connected with your colleagues can help you stay motivated and productive. Use video conferencing, instant messaging, and other tools to stay in touch with your team. You can also schedule regular check-ins or virtual meetings to stay on top of your work."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, working from home can be challenging, but it is possible to maintain productivity and focus. By creating a dedicated workspace, setting a schedule, prioritizing your tasks, taking breaks, and staying connected with your colleagues, you can stay productive while working remotely."}]}]}',
        },
        images: { image: 'blog-productivity.webp' },
      },
      {
        values: {
          name: 'The Rise of Plant-based Diets',
          slug: 'the-rise-of-plant-based-diets',
          description: 'Understanding the health and environmental benefits of a plant-based diet.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The plant-based diet is gaining popularity as more people are becoming aware of the health and environmental benefits it offers. A plant-based diet is a diet that focuses on consuming whole grains, fruits, vegetables, legumes, and nuts, while limiting or eliminating animal products such as meat, dairy, and eggs."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the main benefits of a plant-based diet is that it can improve overall health. Studies have shown that plant-based diets are associated with a lower risk of heart disease, type 2 diabetes, and certain types of cancer. Plant-based diets are also high in fiber, vitamins, and minerals, which can help lower cholesterol and blood pressure and improve gut health."}]},{"type":"paragraph","content":[{"type":"text","text":"Another benefit of a plant-based diet is that it can be more environmentally sustainable. Animal agriculture is a significant contributor to greenhouse gas emissions and deforestation, and it requires large amounts of water and land. By consuming less meat and dairy, individuals can reduce their environmental impact and help preserve natural resources."}]},{"type":"paragraph","content":[{"type":"text","text":"It\u2019s important to note that a plant-based diet does not necessarily mean a vegan diet and some people may choose to include small amounts of animal products, such as fish, eggs or dairy products. A plant-based diet can be adapted to any individual and their dietary needs."}]},{"type":"paragraph","content":[{"type":"text","text":"To start a plant-based diet, it is recommended to start by incorporating more fruits, vegetables, and whole grains into your meals, and gradually reducing or eliminating animal products. You can also try experimenting with different plant-based protein sources such as beans, lentils, and tofu."}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, the rise of plant-based diets is driven by the recognition of the health and environmental benefits they offer. By consuming more fruits, vegetables, and whole grains and limiting or eliminating animal products, individuals can improve their health and reduce their environmental impact. It\u2019s important to note that a plant-based diet can be adapted to any individual, and it\u2019s not necessary to be vegan to have a plant-based diet."}]}]}',
        },
        images: { image: 'blog-plant-diets.webp' },
      },
      {
        values: {
          name: 'The Importance of Self-Care',
          slug: 'the-importance-of-self-care',
          description: 'How to prioritize your well-being in a busy world with exercise, mindfulness, and relaxation.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Self-care is the practice of taking care of one\u2019s physical, mental, and emotional well-being. It\u2019s the act of taking time to focus on yourself, your needs, and your well-being in the midst of a busy and demanding world. In today\u2019s fast-paced society, self-care is more important than ever."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the biggest barriers to self-care is the belief that it is selfish or unnecessary. However, self-care is essential for maintaining good physical and mental health, and it can help you perform better in all areas of your life. When you take care of yourself, you\u2019re better able to take care of others and meet the demands of your daily life."}]},{"type":"paragraph","content":[{"type":"text","text":"Self-care practices can include things like exercise, healthy eating, getting enough sleep, and making time for relaxation and hobbies. Engaging in regular self-care practices can help improve mood, reduce stress, and boost overall well-being."}]},{"type":"paragraph","content":[{"type":"text","text":"Another important aspect of self-care is self-compassion. It\u2019s being kind and understanding to yourself when things don\u2019t go as planned, and not being too hard on yourself. It\u2019s recognizing that it\u2019s okay to make mistakes and it\u2019s important to have patience and forgiveness towards yourself."}]}]}',
        },
        images: { image: 'blog-self-care.webp' },
      },
      {
        values: {
          name: '10 Simple Ways to Declutter Your Home',
          slug: '10-simple-ways-to-declutter-your-home',
          description: 'Simple and practical tips for decluttering your home, including getting rid of unnecessary items and creating a more minimalist living space.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Decluttering your home can feel overwhelming, but it doesn\u2019t have to be. With a few simple strategies, you can create a more organized and peaceful living space. Here are ten practical tips to help you get started:"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Start small: Don\u2019t try to declutter your entire home in one day. Pick one drawer, one shelf, or one corner and focus on that. Small wins build momentum and make the process feel manageable."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Follow the one-in-one-out rule: For every new item you bring into your home, remove one item. This simple habit prevents clutter from accumulating over time."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Create a donation pile: As you go through your belongings, set aside items that are in good condition but no longer serve you. Donating to charity gives your items a second life and helps those in need."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Get rid of duplicates: Do you really need five spatulas or three sets of bed sheets? Keep your favorite and let go of the rest."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Check expiration dates: Go through your pantry, medicine cabinet, and beauty products. Toss anything that\u2019s expired or that you haven\u2019t used in the past year."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Organize your closet: Turn all your hangers backwards. After you wear something, turn the hanger the right way. After a few months, donate anything still on a backwards hanger."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Use clear storage containers: Being able to see what\u2019s inside your storage bins makes it easier to find things and prevents you from buying duplicates."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Digital declutter: Don\u2019t forget about digital clutter. Unsubscribe from emails you never read, delete unused apps, and organize your files and photos."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Create a maybe pile: If you\u2019re unsure about an item, put it in a box and store it for 30 days. If you don\u2019t reach for it in that time, it\u2019s safe to let it go."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Keep it simple: Resist the urge to buy organizing products before you\u2019ve decluttered. The goal is to have less stuff, not more containers to hold stuff."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Remember, decluttering is not a one-time event but an ongoing practice. By incorporating these habits into your daily routine, you can maintain a clean, organized home that brings you peace and joy."}]}]}',
        },
        images: { image: 'blog-declutter.webp' },
      },
      {
        values: {
          name: 'The Science of Sleep',
          slug: 'the-science-of-sleep',
          description: 'Exploring the science of sleep and tips for getting a better night\u2019s rest.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Sleep is one of the most important aspects of our daily lives, yet many of us don\u2019t get enough of it. Understanding the science behind sleep can help you improve the quality of your rest and overall health."}]},{"type":"paragraph","content":[{"type":"text","text":"Sleep occurs in cycles, each lasting about 90 minutes. During a typical night, you\u2019ll go through four to six of these cycles. Each cycle consists of several stages: light sleep, deep sleep, and REM (rapid eye movement) sleep."}]},{"type":"paragraph","content":[{"type":"text","text":"Light sleep is the transition between wakefulness and sleep. During this stage, your heart rate slows, your muscles relax, and your body temperature drops. It\u2019s easy to be woken up during light sleep."}]},{"type":"paragraph","content":[{"type":"text","text":"Deep sleep is the most restorative stage. During deep sleep, your body repairs tissues, builds bone and muscle, and strengthens the immune system. This stage is crucial for physical recovery and growth."}]},{"type":"paragraph","content":[{"type":"text","text":"REM sleep is when most dreaming occurs. Your brain is highly active during REM sleep, processing emotions and consolidating memories. This stage is essential for cognitive function, learning, and creativity."}]},{"type":"paragraph","content":[{"type":"text","text":"To improve your sleep quality, establish a consistent sleep routine by going to bed and waking up at the same time every day. Create a comfortable sleep environment that is dark, quiet, and cool. Avoid caffeine and heavy meals close to bedtime."}]},{"type":"paragraph","content":[{"type":"text","text":"Managing stress is also important for good sleep. Practices like meditation, deep breathing, and journaling before bed can help calm your mind. Limiting screen time in the hour before sleep can also improve your ability to fall asleep."}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, understanding the science of sleep and implementing good sleep hygiene practices can significantly improve the quality of your rest. Prioritizing sleep is one of the best things you can do for your physical and mental health."}]}]}',
        },
        images: { image: 'blog-sleep.webp' },
      },
      {
        values: {
          name: 'Investing 101: A Beginner\u2019s Guide',
          slug: 'investing-101',
          description: 'An introduction to the basics of investing, including different types of investments and the importance of diversification.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Investing can seem intimidating if you\u2019re just getting started, but understanding the basics can help you build wealth over time. The key is to start early, stay consistent, and make informed decisions."}]},{"type":"paragraph","content":[{"type":"text","text":"Before you begin investing, it\u2019s important to define your financial goals. Are you saving for retirement, a down payment on a house, or your children\u2019s education? Your goals will determine your investment strategy and time horizon."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the fundamental concepts of investing is the relationship between risk and reward. Generally, investments with higher potential returns come with higher risk. Understanding your risk tolerance is essential for building a portfolio you\u2019re comfortable with."}]},{"type":"paragraph","content":[{"type":"text","text":"Tax-advantaged accounts like 401(k)s and IRAs are great places to start investing. Many employers offer matching contributions to 401(k) plans, which is essentially free money. Take full advantage of these benefits before investing in taxable accounts."}]},{"type":"paragraph","content":[{"type":"text","text":"Index funds are an excellent option for beginners. These funds track a market index, such as the S&P 500, and provide broad market exposure at a low cost. They\u2019re a simple way to diversify your investments without having to pick individual stocks."}]},{"type":"paragraph","content":[{"type":"text","text":"If you\u2019re interested in picking individual stocks, do your research. Look at a company\u2019s financial statements, competitive advantages, and growth potential. However, remember that even experienced investors can\u2019t consistently beat the market."}]},{"type":"paragraph","content":[{"type":"text","text":"Diversification is one of the most important principles of investing. By spreading your investments across different asset classes, sectors, and geographies, you can reduce the impact of any single investment performing poorly."}]},{"type":"paragraph","content":[{"type":"text","text":"Finally, patience is key. The stock market will have ups and downs, but historically it has trended upward over the long term. Avoid the temptation to time the market or make emotional decisions based on short-term fluctuations. Stay the course and let compound interest work in your favor."}]}]}',
        },
        images: { image: 'blog-investing.webp' },
      },
      {
        values: {
          name: 'The Best Travel Destinations for Adventure Seekers',
          slug: 'best-travel-destinations-for-adventure-seekers',
          description: 'Highlighting the best travel destinations for those who love adventure and outdoor activities.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"For those who crave adrenaline and unforgettable experiences, the world is full of incredible destinations that offer adventure at every turn. Whether you\u2019re into hiking, surfing, or exploring remote wilderness, here are six destinations that should be on every adventure seeker\u2019s bucket list:"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"New Zealand: Known as the adventure capital of the world, New Zealand offers bungee jumping, skydiving, white-water rafting, and some of the most stunning hiking trails on earth, including the famous Milford Track."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Costa Rica: With its lush rainforests, active volcanoes, and pristine beaches, Costa Rica is a paradise for nature lovers. Try zip-lining through the cloud forest, surfing on the Pacific coast, or exploring the Arenal Volcano region."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nepal: Home to the Himalayas, Nepal is a must-visit for trekkers and mountaineers. The Everest Base Camp trek and the Annapurna Circuit are bucket-list experiences that offer breathtaking views and cultural immersion."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Iceland: From glacier hiking and ice cave exploration to snorkeling between tectonic plates at Silfra, Iceland is a land of extraordinary natural wonders. The Northern Lights add an extra layer of magic to any winter visit."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Patagonia (Argentina/Chile): This remote region at the southern tip of South America offers some of the most dramatic landscapes on the planet. Trek through Torres del Paine, kayak among glaciers, or ride horses across the vast steppe."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Canada: From the Rocky Mountains of British Columbia to the rugged coastline of Newfoundland, Canada offers endless adventure. Try backcountry skiing, canoeing in Algonquin Park, or bear watching in the Great Bear Rainforest."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"No matter which destination you choose, remember that the best adventures come with preparation and respect for nature. Research your destination, pack appropriately, and always follow local guidelines to ensure a safe and memorable experience."}]}]}',
        },
        images: { image: 'blog-travel.webp' },
      },
      {
        values: {
          name: 'The Power of Positive Thinking',
          slug: 'the-power-of-positive-thinking',
          description: 'How to change your mindset for success through the power of positive thinking.',
          content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Positive thinking is more than just a feel-good phrase. Research has shown that maintaining a positive mindset can have real, measurable benefits for your health, relationships, and career. It\u2019s not about ignoring life\u2019s challenges, but rather about approaching them with a constructive attitude."}]},{"type":"paragraph","content":[{"type":"text","text":"One of the key benefits of positive thinking is improved coping skills. When faced with stressful situations, positive thinkers tend to focus on solutions rather than dwelling on problems. This proactive approach leads to better outcomes and less emotional distress."}]},{"type":"paragraph","content":[{"type":"text","text":"Positive thinking can also help you achieve your goals. When you believe in your ability to succeed, you\u2019re more likely to take action, persist through setbacks, and ultimately reach your objectives. This self-fulfilling prophecy is supported by decades of psychological research."}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Practice gratitude: Take a few minutes each day to write down three things you\u2019re grateful for. This simple habit shifts your focus from what\u2019s lacking to what\u2019s abundant in your life."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Surround yourself with positive people: The people you spend time with influence your mindset. Seek out relationships that uplift and inspire you, and limit time with those who drain your energy."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Take responsibility for your thoughts: You can\u2019t control every situation, but you can control how you respond. When negative thoughts arise, acknowledge them and consciously choose a more constructive perspective."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Use positive affirmations: Start your day with affirmations that reinforce your strengths and goals. Statements like \u201cI am capable\u201d or \u201cI attract success\u201d can rewire your brain over time."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Make time to relax: Chronic stress is the enemy of positive thinking. Incorporate relaxation practices like meditation, yoga, or simply spending time in nature into your routine."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"In conclusion, the power of positive thinking lies in its ability to transform how you experience the world. By cultivating a positive mindset through gratitude, supportive relationships, and intentional thought patterns, you can improve your well-being and unlock your full potential."}]}]}',
        },
        images: { image: 'blog-positive-thinking.webp' },
      },
    ],
  },
  {
    id: 'people',
    name: 'People',
    customFields: [
      { name: 'Picture', key: 'picture', type: 'image', fillable: true, hidden: false, order: 5 },
      { name: 'Job Title', key: 'job_title', type: 'text', fillable: true, hidden: false, order: 6 },
      { name: 'Description', key: 'description', type: 'text', fillable: true, hidden: false, order: 7 },
      { name: 'Email', key: 'email', type: 'email', fillable: true, hidden: false, order: 8 },
      { name: 'Phone', key: 'phone', type: 'phone', fillable: true, hidden: false, order: 9 },
    ],
    items: [
      {
        values: {
          name: 'Sarah Johnson',
          slug: 'sarah-johnson',
          job_title: 'Chief Executive Officer',
          description: 'Sarah has over 15 years of experience in leading tech companies and driving innovation.',
          email: 'sarah@example.com',
          phone: '+1 (555) 100-2000',
        },
        images: { picture: 'profile-picture-1.webp' },
      },
      {
        values: {
          name: 'Michael Chen',
          slug: 'michael-chen',
          job_title: 'Lead Developer',
          description: 'Michael specializes in full-stack development with expertise in React and Node.js.',
          email: 'michael@example.com',
          phone: '+1 (555) 100-3000',
        },
        images: { picture: 'profile-picture-2.webp' },
      },
      {
        values: {
          name: 'Emily Davis',
          slug: 'emily-davis',
          job_title: 'Design Director',
          description: 'Emily brings a unique blend of creativity and strategic thinking to every project.',
          email: 'emily@example.com',
          phone: '+1 (555) 100-4000',
        },
        images: { picture: 'profile-picture-3.webp' },
      },
      {
        values: {
          name: 'James Wilson',
          slug: 'james-wilson',
          job_title: 'Marketing Manager',
          description: 'James has a proven track record of building successful marketing campaigns.',
          email: 'james@example.com',
          phone: '+1 (555) 100-5000',
        },
        images: { picture: 'profile-picture-4.webp' },
      },
      {
        values: {
          name: 'Lisa Martinez',
          slug: 'lisa-martinez',
          job_title: 'Product Manager',
          description: 'Lisa excels at translating business requirements into product features users love.',
          email: 'lisa@example.com',
          phone: '+1 (555) 100-6000',
        },
        images: { picture: 'profile-picture-5.webp' },
      },
      {
        values: {
          name: 'Jacey Nielsen',
          slug: 'jacey-nielsen',
          job_title: 'UI/UX Specialist',
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          email: 'jacey.nielsen@example.com',
          phone: '212-214-7880',
        },
        images: { picture: 'profile-picture-6.webp' },
      },
      {
        values: {
          name: 'Elianna Dalton',
          slug: 'elianna-dalton',
          job_title: 'Marketing Manager',
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          email: 'elianna.dalton@example.com',
          phone: '212-216-7626',
        },
        images: { picture: 'profile-picture-7.webp' },
      },
      {
        values: {
          name: 'Parker Wolfe',
          slug: 'parker-wolfe',
          job_title: 'Sales Manager',
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          email: 'parker.wolfe@example.com',
          phone: '212-218-4151',
        },
        images: { picture: 'profile-picture-8.webp' },
      },
      {
        values: {
          name: 'Julio Hart',
          slug: 'julio-hart',
          job_title: 'Frontend Developer',
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          email: 'julio.hart@example.com',
          phone: '212-220-8899',
        },
        images: { picture: 'profile-picture-9.webp' },
      },
      {
        values: {
          name: 'Ruth Collier',
          slug: 'ruth-collier',
          job_title: 'Backend Developer',
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          email: 'ruth.collier@example.com',
          phone: '212-222-2122',
        },
        images: { picture: 'profile-picture-10.webp' },
      },
    ],
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    customFields: [
      { name: 'Avatar', key: 'avatar', type: 'image', fillable: true, hidden: false, order: 5 },
      { name: 'Quote', key: 'quote', type: 'text', fillable: true, hidden: false, order: 6 },
      { name: 'Rating', key: 'rating', type: 'number', fillable: true, hidden: false, order: 7 },
      { name: 'Company', key: 'company', type: 'text', fillable: true, hidden: false, order: 8 },
    ],
    items: [
      {
        values: {
          name: 'Alex Thompson',
          slug: 'alex-thompson',
          quote: 'This product completely transformed how our team collaborates. We saw a 40% increase in productivity within the first month.',
          rating: '5',
          company: 'TechCorp Solutions',
        },
        images: { avatar: 'profile-picture-1.webp' },
      },
      {
        values: {
          name: 'Maria Garcia',
          slug: 'maria-garcia',
          quote: 'The best investment we made this year. The support team is incredibly responsive and helpful.',
          rating: '5',
          company: 'Creative Studios',
        },
        images: { avatar: 'profile-picture-2.webp' },
      },
      {
        values: {
          name: 'David Park',
          slug: 'david-park',
          quote: 'Easy to set up and even easier to use. Our clients love the results we deliver now.',
          rating: '4',
          company: 'Digital Agency Pro',
        },
        images: { avatar: 'profile-picture-3.webp' },
      },
      {
        values: {
          name: 'Rachel Green',
          slug: 'rachel-green',
          quote: 'We switched from our old platform and never looked back. The features are exactly what we needed.',
          rating: '5',
          company: 'StartUp Hub',
        },
        images: { avatar: 'profile-picture-4.webp' },
      },
      {
        values: {
          name: 'Tom Williams',
          slug: 'tom-williams',
          quote: 'Intuitive interface and powerful features. It has become an essential part of our workflow.',
          rating: '4',
          company: 'Enterprise Solutions Inc.',
        },
        images: { avatar: 'profile-picture-5.webp' },
      },
      {
        values: {
          name: 'Jacey Nielsen',
          slug: 'jacey-nielsen',
          quote: 'Outstanding value for money. The features included far exceeded our expectations for the price point.',
          rating: '5',
          company: 'Innovation Labs',
        },
        images: { avatar: 'profile-picture-6.webp' },
      },
      {
        values: {
          name: 'Elianna Dalton',
          slug: 'elianna-dalton',
          quote: 'The onboarding process was seamless. We were up and running within hours, not weeks.',
          rating: '5',
          company: 'Dalton & Co.',
        },
        images: { avatar: 'profile-picture-7.webp' },
      },
      {
        values: {
          name: 'Parker Wolfe',
          slug: 'parker-wolfe',
          quote: 'A game-changer for our sales team. The analytics dashboard alone has paid for itself ten times over.',
          rating: '4',
          company: 'Wolfe Industries',
        },
        images: { avatar: 'profile-picture-8.webp' },
      },
      {
        values: {
          name: 'Julio Hart',
          slug: 'julio-hart',
          quote: 'Finally a tool that our entire team actually enjoys using. The UI is clean and the performance is excellent.',
          rating: '5',
          company: 'Hart Technologies',
        },
        images: { avatar: 'profile-picture-9.webp' },
      },
      {
        values: {
          name: 'Ruth Collier',
          slug: 'ruth-collier',
          quote: 'Reliable, fast, and constantly improving. The development team clearly listens to user feedback.',
          rating: '4',
          company: 'Collier Systems',
        },
        images: { avatar: 'profile-picture-10.webp' },
      },
    ],
  },
  {
    id: 'categories',
    name: 'Categories',
    customFields: [
      { name: 'Description', key: 'description', type: 'text', fillable: true, hidden: false, order: 5 },
    ],
    items: [
      {
        values: {
          name: 'Technology',
          slug: 'technology',
          description: 'Articles and resources about the latest in tech, software, and digital innovation.',
        },
      },
      {
        values: {
          name: 'Business',
          slug: 'business',
          description: 'Insights on entrepreneurship, management, and growing a successful business.',
        },
      },
      {
        values: {
          name: 'Design',
          slug: 'design',
          description: 'Trends, tips, and inspiration for UI/UX design, branding, and visual communication.',
        },
      },
      {
        values: {
          name: 'Marketing',
          slug: 'marketing',
          description: 'Strategies and best practices for digital marketing, SEO, and content creation.',
        },
      },
      {
        values: {
          name: 'Lifestyle',
          slug: 'lifestyle',
          description: 'Content about health, wellness, productivity, and work-life balance.',
        },
      },
      {
        values: {
          name: 'Health & Wellness',
          slug: 'health-wellness',
          description: 'Topics related to physical health, mental wellness, nutrition, and fitness.',
        },
      },
      {
        values: {
          name: 'Finance',
          slug: 'finance',
          description: 'Personal finance, investing, budgeting, and building wealth.',
        },
      },
      {
        values: {
          name: 'Travel',
          slug: 'travel',
          description: 'Travel guides, destination reviews, and tips for planning your next adventure.',
        },
      },
      {
        values: {
          name: 'Productivity',
          slug: 'productivity',
          description: 'Tools, techniques, and habits to maximize your output and manage your time effectively.',
        },
      },
      {
        values: {
          name: 'Education',
          slug: 'education',
          description: 'Learning resources, skill development, and educational content for professionals.',
        },
      },
    ],
  },
];

/** Get a sample collection definition by ID */
export function getSampleCollectionById(id: string): SampleCollectionDefinition | undefined {
  return SAMPLE_COLLECTIONS.find(sc => sc.id === id);
}

/** Get summary list for the UI dropdown */
export function getSampleCollectionOptions(): Array<{ id: string; name: string }> {
  return SAMPLE_COLLECTIONS.map(({ id, name }) => ({ id, name }));
}
