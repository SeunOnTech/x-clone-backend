import { PrismaClient, PostType } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Fetch the latest 10 posts (excluding replies)
 */
export async function getLatestPosts(limit: number = 10) {
  const posts = await prisma.post.findMany({
    where: {
      postType: {
        not: PostType.REPLY, // Exclude replies
      },
    },
    orderBy: {
      createdAt: "desc", // Sort newest first
    },
    take: limit,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
        },
      },
      crisis: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
    },
  })

  return posts
}

// Example usage:
async function main() {
  const latestPosts = await getLatestPosts()
  console.log("Latest posts:", latestPosts)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
